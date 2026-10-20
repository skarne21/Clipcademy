"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicLesson } from "@/lib/lessons-public";
import type { GenerateLessonResponse } from "@/lib/generation/public-response";
import { LessonVideo } from "@/components/LessonVideo";
import { LessonPractice } from "@/components/LessonPractice";

type GenerationState = "idle" | "loading" | "ready" | "error";

export function FeedClient() {
  const [lessons, setLessons] = useState<PublicLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => new Set());
  const [genState, setGenState] = useState<Record<string, GenerationState>>({});
  const [genContent, setGenContent] = useState<Record<string, GenerateLessonResponse>>({});
  const [genError, setGenError] = useState<Record<string, string>>({});
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/lessons");
        const body = (await res.json()) as { lessons?: PublicLesson[]; error?: string };
        if (!res.ok) {
          throw new Error(body.error ?? "Failed to load lessons");
        }
        if (!cancelled) {
          setLessons(body.lessons ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load lessons");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestGeneration = useCallback(async (lessonId: string) => {
    if (inFlight.current.has(lessonId)) return;
    inFlight.current.add(lessonId);
    setGenState((s) => ({ ...s, [lessonId]: "loading" }));
    setGenError((s) => {
      const next = { ...s };
      delete next[lessonId];
      return next;
    });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      const body = (await res.json()) as GenerateLessonResponse & { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Generation request failed");
      }
      setGenContent((s) => ({ ...s, [lessonId]: body }));
      setGenState((s) => ({ ...s, [lessonId]: "ready" }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Generation request failed";
      setGenError((s) => ({ ...s, [lessonId]: message }));
      setGenState((s) => ({ ...s, [lessonId]: "error" }));
    } finally {
      inFlight.current.delete(lessonId);
    }
  }, []);

  const markWatched = useCallback(
    (lessonId: string) => {
      setWatchedIds((prev) => {
        if (prev.has(lessonId)) return prev;
        const next = new Set(prev);
        next.add(lessonId);
        return next;
      });
      void requestGeneration(lessonId);
    },
    [requestGeneration],
  );

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-zinc-400">
        Loading feed…
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-red-400">{error}</p>
        <p className="max-w-md text-sm text-zinc-500">
          Start Postgres with <code className="text-zinc-300">docker compose up -d postgres</code>
          , copy <code className="text-zinc-300">.env.example</code> to{" "}
          <code className="text-zinc-300">.env</code>, then run{" "}
          <code className="text-zinc-300">npm run db:push</code> and{" "}
          <code className="text-zinc-300">npm run db:seed</code>.
        </p>
      </main>
    );
  }

  if (lessons.length === 0) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-zinc-400">
        No lessons in the catalog. Run the seed script.
      </main>
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Clipcademy</h1>
        <p className="text-xs text-zinc-500">Beginner Python · swipe for next lesson</p>
      </header>

      <div className="feed-scroll min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto">
        {lessons.map((lesson) => {
          const watched = watchedIds.has(lesson.id);
          const practiceState = genState[lesson.id] ?? "idle";

          return (
            <section
              key={lesson.id}
              className="feed-card flex min-h-full flex-col gap-4 px-4 py-4"
              aria-label={lesson.title}
            >
              <div className="shrink-0">
                <div className="mb-1 flex flex-wrap gap-2">
                  {lesson.topicTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
                    {lesson.difficulty}
                  </span>
                </div>
                <h2 className="text-xl font-semibold leading-snug">{lesson.title}</h2>
                <p className="mt-1 text-sm text-zinc-400">{lesson.learningGoal}</p>
              </div>

              <LessonVideo
                youtubeId={lesson.youtubeId}
                title={lesson.title}
                watched={watched}
                onWatched={() => markWatched(lesson.id)}
              />

              {watched && (
                <LessonPractice
                  lessonId={lesson.id}
                  state={practiceState === "idle" ? "loading" : practiceState}
                  content={genContent[lesson.id] ?? null}
                  errorMessage={genError[lesson.id]}
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
