import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { __sandboxExecutionBudgetMs, formatCodeTimeoutMessage, runPythonInSandbox } from "./sandbox";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";

function mockChild(options: {
  stdoutDelayMs?: number;
  stdoutPayload?: string;
  neverStdout?: boolean;
}) {
  const stdin = { write: vi.fn(), end: vi.fn() };
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const child = new EventEmitter() as EventEmitter & {
    stdin: typeof stdin;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdin = stdin;
  child.stdout = stdout;
  child.stderr = stderr;
  child.kill = vi.fn();

  if (!options.neverStdout) {
    const payload =
      options.stdoutPayload ??
      JSON.stringify({
        ok: true,
        status: "completed",
        error: null,
        results: [],
        timings: { setup_ms: 1, tests_ms: 0, total_ms: 2 },
      });
    setTimeout(() => {
      stdout.emit("data", Buffer.from(payload));
      setTimeout(() => child.emit("close", 0), 5);
    }, options.stdoutDelayMs ?? 10);
  } else {
    setTimeout(() => child.emit("close", 137), 50);
  }

  return child;
}

describe("sandbox docker timing", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SANDBOX_MOCK_JSON;
    process.env.SANDBOX_STARTUP_TIMEOUT_MS = "80";
    process.env.SANDBOX_DOCKER_GRACE_MS = "20";
    process.env.SANDBOX_TIMEOUT_SECONDS = "1";
  });

  it("reports Sandbox failed to start when container never responds", async () => {
    vi.mocked(spawn).mockReturnValue(mockChild({ neverStdout: true }) as never);
    process.env.SANDBOX_STARTUP_TIMEOUT_MS = "30";

    const result = await runPythonInSandbox({ code: "pass", tests: [] });
    expect(result.status).toBe("docker_error");
    expect(result.error).toBe("Sandbox failed to start");
    expect(result.timings?.containerStartupMs).toBeGreaterThanOrEqual(0);
  });

  it("merges container startup and sandbox execution timings from JSON", async () => {
    vi.mocked(spawn).mockReturnValue(mockChild({ stdoutDelayMs: 5 }) as never);

    const result = await runPythonInSandbox({ code: "pass", tests: [] });
    expect(result.ok).toBe(true);
    expect(result.timings?.containerStartupMs).toBeGreaterThanOrEqual(0);
    expect(result.timings?.setupMs).toBe(1);
    expect(result.timings?.sandboxTotalMs).toBe(2);
  });

  it("execution budget scales with test count", () => {
    expect(__sandboxExecutionBudgetMs(5, 4)).toBe(5 * 1000 * 5);
  });

  it("formats code timeout message for infinite loops", () => {
    expect(formatCodeTimeoutMessage(7)).toBe(
      "Code timed out after 7s (possible infinite loop)",
    );
  });
});
