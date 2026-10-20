import type { GenerateLessonResponse } from "@/lib/generation/public-response";
import { TaskEditor } from "@/components/TaskEditor";

type LessonPracticeProps = {
  lessonId: string;
  state: "loading" | "ready" | "error";
  content: GenerateLessonResponse | null;
  errorMessage?: string | null;
  onSubmitCode?: (code: string) => void;
};

export function LessonPractice({
  lessonId,
  state,
  content,
  errorMessage,
  onSubmitCode,
}: LessonPracticeProps) {
  if (state === "loading") {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
        Building your lesson…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
        {errorMessage ?? "Could not load lesson content."}
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">Explanation</h3>
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          {content.source === "generated" ? "Generated" : "Approved fallback"}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-zinc-300">{content.explanation}</p>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-200">Practice</h3>
        <p className="mb-3 text-sm text-zinc-300">{content.task.prompt}</p>
        <TaskEditor
          lessonId={lessonId}
          starterCode={content.task.starter_code}
          taskPrompt={content.task.prompt}
          functionName={content.task.function_name}
          onSubmit={onSubmitCode}
        />
      </div>

      <div>
        <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Visible tests
        </h4>
        <ul className="list-inside list-disc space-y-1 text-xs text-zinc-400">
          {content.task.visible_tests.map((test) => (
            <li key={test}>
              <code className="text-zinc-300">{test}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
