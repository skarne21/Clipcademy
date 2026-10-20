"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  draftStorageKey,
  EDITOR_CHAR_LIMIT,
  removeDraft,
  resolveInitialEditorCode,
  saveDraft,
  type TaskDraftIdentity,
} from "@/lib/editor/draft-storage";

const CodeMirrorEditor = dynamic(
  () => import("@/components/CodeMirrorEditor").then((m) => m.CodeMirrorEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-48 items-center justify-center rounded-lg border border-zinc-700/80 bg-black/50 text-sm text-zinc-500"
        aria-busy="true"
      >
        Loading editor…
      </div>
    ),
  },
);

export type TaskEditorProps = {
  lessonId: string;
  starterCode: string;
  taskPrompt: string;
  functionName: string;
  onSubmit?: (code: string) => void;
};

export function TaskEditor({
  lessonId,
  starterCode,
  taskPrompt,
  functionName,
  onSubmit,
}: TaskEditorProps) {
  const identity: TaskDraftIdentity = useMemo(
    () => ({
      lessonId,
      starterCode,
      prompt: taskPrompt,
      functionName,
    }),
    [lessonId, starterCode, taskPrompt, functionName],
  );

  const draftKey = useMemo(() => draftStorageKey(identity), [identity]);

  const [code, setCode] = useState(() => resolveInitialEditorCode(identity, starterCode));
  const [limitMessage, setLimitMessage] = useState(false);
  const starterRef = useRef(starterCode);
  const identityKeyRef = useRef(draftKey);

  useEffect(() => {
    if (identityKeyRef.current === draftKey) return;
    identityKeyRef.current = draftKey;
    starterRef.current = starterCode;
    setCode(resolveInitialEditorCode(identity, starterCode));
    setLimitMessage(false);
  }, [draftKey, identity, starterCode]);

  useEffect(() => {
    saveDraft(draftKey, code);
  }, [draftKey, code]);

  const handleChange = useCallback((next: string) => {
    setCode(next.slice(0, EDITOR_CHAR_LIMIT));
    if (next.length < EDITOR_CHAR_LIMIT) {
      setLimitMessage(false);
    }
  }, []);

  const handleAtLimit = useCallback(() => {
    setLimitMessage(true);
  }, []);

  const handleReset = useCallback(() => {
    const baseline = starterRef.current;
    if (code === baseline) {
      setCode(baseline);
      return;
    }
    const ok = window.confirm("Reset your code to the starter template? Your changes will be lost.");
    if (!ok) return;
    setCode(baseline);
    setLimitMessage(false);
    removeDraft(draftKey);
  }, [code, draftKey]);

  const handleSubmit = useCallback(() => {
    onSubmit?.(code);
  }, [code, onSubmit]);

  return (
    <div className="task-editor flex flex-col gap-2" data-testid="task-editor">
      <div
        className="task-editor-surface touch-pan-y"
        onTouchMove={(e) => {
          e.stopPropagation();
        }}
      >
        <CodeMirrorEditor
          value={code}
          onChange={handleChange}
          onAtCharLimit={handleAtLimit}
          ariaLabel="Practice code editor"
        />
      </div>

      {limitMessage && (
        <p className="text-sm text-amber-200/90" role="status">
          You&apos;ve reached the {EDITOR_CHAR_LIMIT.toLocaleString()} character limit for this
          editor.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
        >
          Reset
        </button>
        <button
          type="button"
          disabled
          onClick={handleSubmit}
          className="rounded-lg bg-blue-600/40 px-3 py-2 text-sm font-medium text-zinc-400"
          aria-disabled="true"
        >
          Grading coming soon
        </button>
      </div>
    </div>
  );
}
