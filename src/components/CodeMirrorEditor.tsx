"use client";

import { useEffect, useRef } from "react";
import type { EditorView } from "@codemirror/view";
import { EDITOR_CHAR_LIMIT } from "@/lib/editor/draft-storage";

export type CodeMirrorEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onAtCharLimit?: () => void;
  ariaLabel?: string;
};

export function CodeMirrorEditor({
  value,
  onChange,
  onAtCharLimit,
  ariaLabel = "Python code editor",
}: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onLimitRef = useRef(onAtCharLimit);

  onChangeRef.current = onChange;
  onLimitRef.current = onAtCharLimit;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let destroyed = false;
    let view: EditorView | null = null;

    async function mount() {
      const [
        { EditorState },
        { EditorView, lineNumbers, keymap, drawSelection, highlightActiveLine },
        { defaultKeymap, indentWithTab },
        { python },
        {
          bracketMatching,
          indentOnInput,
          syntaxHighlighting,
          defaultHighlightStyle,
          indentUnit,
        },
        { oneDark },
      ] = await Promise.all([
        import("@codemirror/state"),
        import("@codemirror/view"),
        import("@codemirror/commands"),
        import("@codemirror/lang-python"),
        import("@codemirror/language"),
        import("@codemirror/theme-one-dark"),
      ]);

      if (destroyed || !hostRef.current) return;

      const state = EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          drawSelection(),
          bracketMatching(),
          indentOnInput(),
          indentUnit.of("    "),
          python(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          oneDark,
          keymap.of([...defaultKeymap, indentWithTab]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
          EditorView.theme({
            "&": {
              fontSize: "16px",
              backgroundColor: "transparent",
            },
            ".cm-scroller": {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              overscrollBehavior: "contain",
            },
            ".cm-content": {
              minHeight: "12rem",
              caretColor: "#f4f4f5",
            },
            ".cm-gutters": {
              backgroundColor: "rgba(0,0,0,0.35)",
              border: "none",
            },
          }),
          EditorState.changeFilter.of((tr) => {
            if (!tr.docChanged) return true;
            if (tr.newDoc.length <= EDITOR_CHAR_LIMIT) return true;
            onLimitRef.current?.();
            return false;
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      });

      view = new EditorView({ state, parent: hostRef.current });
      viewRef.current = view;

      const scrollIntoViewOnFocus = () => {
        hostRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
      view.dom.addEventListener("focus", scrollIntoViewOnFocus, { passive: true });
      view.dom.addEventListener("click", scrollIntoViewOnFocus, { passive: true });
    }

    void mount();

    return () => {
      destroyed = true;
      view?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; value synced below
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={hostRef}
      className="task-editor-cm min-h-48 overflow-hidden rounded-lg border border-zinc-700/80 bg-black/50"
      data-testid="codemirror-host"
    />
  );
}
