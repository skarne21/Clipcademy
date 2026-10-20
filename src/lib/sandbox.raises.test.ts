import { describe, expect, it } from "vitest";
import { runPythonInSandbox } from "./sandbox";

const dockerAvailable = process.env.SANDBOX_INTEGRATION === "true";

describe.runIf(dockerAvailable)("sandbox raises() helper", () => {
  it("passes when the function raises the expected exception", async () => {
    const result = await runPythonInSandbox({
      code: "def access_list_element(items, i):\n    return items[i]\n",
      tests: ["assert raises(IndexError, access_list_element, [], 0)"],
      timeoutSeconds: 3,
    });
    expect(result.ok).toBe(true);
    expect(result.results[0]?.passed).toBe(true);
  });

  it("fails invalid assert-trailing-raises syntax at test_syntax_error", async () => {
    const result = await runPythonInSandbox({
      code: "def access_list_element(items, i):\n    return items[i]\n",
      tests: ["assert access_list_element([], 0) raises IndexError"],
      timeoutSeconds: 3,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("test_syntax_error");
  });
});
