import { describe, expect, it } from "vitest";
import { parseSandboxResult } from "./sandbox";

describe("parseSandboxResult", () => {
  it("normalizes sandbox JSON", () => {
    const parsed = parseSandboxResult({
      ok: false,
      status: "timeout",
      error: "test 1 timed out",
      results: [{ index: 0, passed: false, stdout: "", error: "timeout" }],
    });
    expect(parsed.status).toBe("timeout");
    expect(parsed.results[0].error).toBe("timeout");
  });
});
