export const EDITOR_CHAR_LIMIT = 5000;

export type TaskDraftIdentity = {
  lessonId: string;
  starterCode: string;
  prompt: string;
  functionName: string;
};

export function hashTaskForDraft(task: Omit<TaskDraftIdentity, "lessonId">): string {
  const payload = JSON.stringify({
    starter_code: task.starterCode,
    prompt: task.prompt,
    function_name: task.functionName,
  });
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 33) ^ payload.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function draftStorageKey(identity: TaskDraftIdentity): string {
  const taskHash = hashTaskForDraft({
    starterCode: identity.starterCode,
    prompt: identity.prompt,
    functionName: identity.functionName,
  });
  return `clipcademy:draft:${identity.lessonId}:${taskHash}`;
}

export function loadDraft(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, code: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, code.slice(0, EDITOR_CHAR_LIMIT));
  } catch {
    // ignore quota / private mode
  }
}

export function removeDraft(key: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function resolveInitialEditorCode(
  identity: TaskDraftIdentity,
  starterCode: string,
): string {
  const key = draftStorageKey(identity);
  const draft = loadDraft(key);
  if (draft != null) return draft.slice(0, EDITOR_CHAR_LIMIT);
  return starterCode;
}
