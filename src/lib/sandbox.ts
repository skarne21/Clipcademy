import { spawn } from "node:child_process";

export type SandboxTestResult = {
  index: number;
  passed: boolean;
  stdout: string;
  error: string | null;
};

export type SandboxTimings = {
  containerStartupMs: number;
  sandboxTotalMs?: number;
  setupMs?: number;
  testsMs?: number;
};

export type SandboxRunResult = {
  ok: boolean;
  status:
    | "completed"
    | "syntax_error"
    | "test_syntax_error"
    | "timeout"
    | "invalid_input"
    | "docker_error";
  error: string | null;
  results: SandboxTestResult[];
  timings?: SandboxTimings;
};

export type SandboxRunInput = {
  code: string;
  tests: string[];
  timeoutSeconds?: number;
};

type SandboxJsonPayload = SandboxRunResult & {
  timings?: { setup_ms?: number; tests_ms?: number; total_ms?: number };
};

function getSandboxImage(): string {
  return process.env.SANDBOX_DOCKER_IMAGE?.trim() || "clipcademy-python-sandbox";
}

function getStartupTimeoutMs(): number {
  const n = Number(process.env.SANDBOX_STARTUP_TIMEOUT_MS ?? 15000);
  return Number.isFinite(n) && n > 0 ? n : 15000;
}

function getDockerGraceMs(): number {
  const n = Number(process.env.SANDBOX_DOCKER_GRACE_MS ?? 3000);
  return Number.isFinite(n) && n >= 0 ? n : 3000;
}

function executionBudgetMs(timeoutSeconds: number, testCount: number): number {
  const phaseMs = timeoutSeconds * 1000;
  return phaseMs * (1 + Math.max(testCount, 0));
}

function shouldLogTimings(): boolean {
  return process.env.SANDBOX_LOG_TIMINGS === "true" || process.env.NODE_ENV !== "test";
}

function logSandboxTimings(label: string, timings: SandboxTimings): void {
  if (!shouldLogTimings()) return;
  const parts = [`containerStartupMs=${timings.containerStartupMs}`];
  if (timings.setupMs != null) parts.push(`setupMs=${timings.setupMs}`);
  if (timings.testsMs != null) parts.push(`testsMs=${timings.testsMs}`);
  if (timings.sandboxTotalMs != null) parts.push(`sandboxTotalMs=${timings.sandboxTotalMs}`);
  console.info(`[sandbox] ${label} ${parts.join(" ")}`);
}

function mergeTimings(
  containerStartupMs: number,
  payload?: SandboxJsonPayload,
): SandboxTimings {
  return {
    containerStartupMs,
    sandboxTotalMs: payload?.timings?.total_ms,
    setupMs: payload?.timings?.setup_ms,
    testsMs: payload?.timings?.tests_ms,
  };
}

export function formatCodeTimeoutMessage(timeoutSeconds: number): string {
  return `Code timed out after ${timeoutSeconds}s (possible infinite loop)`;
}

export async function runPythonInSandbox(input: SandboxRunInput): Promise<SandboxRunResult> {
  const timeoutSeconds = input.timeoutSeconds ?? Number(process.env.SANDBOX_TIMEOUT_SECONDS ?? 5);
  const payload = JSON.stringify({
    code: input.code,
    tests: input.tests,
    timeout_seconds: timeoutSeconds,
  });

  if (process.env.SANDBOX_MOCK_JSON) {
    return JSON.parse(process.env.SANDBOX_MOCK_JSON) as SandboxRunResult;
  }

  const image = getSandboxImage();
  const args = [
    "run",
    "--rm",
    "-i",
    "--network",
    "none",
    "--memory=256m",
    "--cpus=0.5",
    image,
  ];

  const startupTimeoutMs = getStartupTimeoutMs();
  const graceMs = getDockerGraceMs();
  const execBudgetMs = executionBudgetMs(timeoutSeconds, input.tests.length);

  return new Promise((resolve) => {
    const runStarted = Date.now();
    let firstByteAt: number | null = null;
    let startupTimer: ReturnType<typeof setTimeout> | null = null;
    let executionTimer: ReturnType<typeof setTimeout> | null = null;

    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: SandboxRunResult) => {
      if (settled) return;
      settled = true;
      if (startupTimer) clearTimeout(startupTimer);
      if (executionTimer) clearTimeout(executionTimer);
      if (result.timings) logSandboxTimings(result.status, result.timings);
      resolve(result);
    };

    const onFirstStdout = () => {
      if (firstByteAt !== null) return;
      firstByteAt = Date.now();
      if (startupTimer) clearTimeout(startupTimer);
      executionTimer = setTimeout(() => {
        child.kill("SIGKILL");
        const startupMs = firstByteAt! - runStarted;
        finish({
          ok: false,
          status: "timeout",
          error: formatCodeTimeoutMessage(timeoutSeconds),
          results: [],
          timings: { containerStartupMs: startupMs },
        });
      }, execBudgetMs + graceMs);
    };

    startupTimer = setTimeout(() => {
      if (firstByteAt !== null) return;
      child.kill("SIGKILL");
      finish({
        ok: false,
        status: "docker_error",
        error: "Sandbox failed to start",
        results: [],
        timings: { containerStartupMs: Date.now() - runStarted },
      });
    }, startupTimeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      onFirstStdout();
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      finish({
        ok: false,
        status: "docker_error",
        error: err.message,
        results: [],
        timings: { containerStartupMs: Date.now() - runStarted },
      });
    });

    child.on("close", (code) => {
      const containerStartupMs =
        firstByteAt !== null ? firstByteAt - runStarted : Date.now() - runStarted;

      if (!stdout.trim()) {
        finish({
          ok: false,
          status: "docker_error",
          error:
            firstByteAt === null
              ? "Sandbox failed to start"
              : stderr.trim() || `docker exited with code ${code ?? "unknown"}`,
          results: [],
          timings: { containerStartupMs },
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as SandboxJsonPayload;
        const timings = mergeTimings(containerStartupMs, parsed);
        finish({
          ok: Boolean(parsed.ok),
          status: parsed.status,
          error: parsed.error ?? null,
          results: (parsed.results ?? []).map((r, index) => ({
            index: r.index ?? index,
            passed: Boolean(r.passed),
            stdout: r.stdout ?? "",
            error: r.error ?? null,
          })),
          timings,
        });
      } catch {
        finish({
          ok: false,
          status: "docker_error",
          error: `Invalid sandbox JSON: ${stdout.slice(0, 200)}`,
          results: [],
          timings: { containerStartupMs },
        });
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}

export function parseSandboxResult(raw: SandboxRunResult): SandboxRunResult {
  return {
    ok: Boolean(raw.ok),
    status: raw.status,
    error: raw.error ?? null,
    results: (raw.results ?? []).map((r, index) => ({
      index: r.index ?? index,
      passed: Boolean(r.passed),
      stdout: r.stdout ?? "",
      error: r.error ?? null,
    })),
    timings: raw.timings,
  };
}

/** @internal test hook */
export function __sandboxExecutionBudgetMs(timeoutSeconds: number, testCount: number): number {
  return executionBudgetMs(timeoutSeconds, testCount);
}
