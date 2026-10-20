import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  draftStorageKey,
  hashTaskForDraft,
  loadDraft,
  removeDraft,
  resolveInitialEditorCode,
  saveDraft,
} from "./draft-storage";

describe("draft-storage", () => {
  const identity = {
    lessonId: "py-conditionals-01",
    starterCode: "def foo():\n    pass\n",
    prompt: "Write foo",
    functionName: "foo",
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it("uses different keys when task content changes", () => {
    const keyA = draftStorageKey(identity);
    const keyB = draftStorageKey({
      ...identity,
      starterCode: "def foo():\n    return 1\n",
    });
    expect(keyA).not.toBe(keyB);
  });

  it("restores draft for same task hash", () => {
    const key = draftStorageKey(identity);
    saveDraft(key, "def foo():\n    return 2\n");
    expect(resolveInitialEditorCode(identity, identity.starterCode)).toBe("def foo():\n    return 2\n");
  });

  it("ignores draft when task hash changes", () => {
    const key = draftStorageKey(identity);
    saveDraft(key, "old draft");
    const newStarter = "def bar():\n    pass\n";
    const resolved = resolveInitialEditorCode(
      { ...identity, starterCode: newStarter, functionName: "bar" },
      newStarter,
    );
    expect(resolved).toBe(newStarter);
    expect(hashTaskForDraft({ starterCode: newStarter, prompt: identity.prompt, functionName: "bar" })).not.toBe(
      hashTaskForDraft({
        starterCode: identity.starterCode,
        prompt: identity.prompt,
        functionName: identity.functionName,
      }),
    );
  });

  it("load/save tolerate storage errors", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadDraft("x")).toBeNull();
    getItem.mockRestore();

    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    saveDraft("x", "code");
    setItem.mockRestore();

    removeDraft("x");
  });
});
