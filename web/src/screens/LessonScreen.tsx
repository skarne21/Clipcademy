import { useEffect, useRef } from "react";
import { formatSourceRefs } from "../content/sourceRefs";

type LessonScreenProps = {
  title: string;
  videoKind: "initial" | "followup";
  videoStatus: "preparing" | "ready" | "failed";
  videoUrl?: string;
  transcript?: string;
  sourceRefs?: string[];
  clipOriginLabel?: string;
  onVideoStarted(): void;
  onVideoCompleted(): void;
  onOpenQuestion(): void;
  onBack(): void;
  onRetryVideo(): void;
};

export function LessonScreen({
  title,
  videoKind,
  videoStatus,
  videoUrl,
  transcript,
  sourceRefs,
  clipOriginLabel,
  onVideoStarted,
  onVideoCompleted,
  onOpenQuestion,
  onBack,
  onRetryVideo,
}: LessonScreenProps) {
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    startedRef.current = false;
    completedRef.current = false;
  }, [videoUrl]);

  const answerEnabled = videoStatus === "ready";
  const sourceLabel =
    sourceRefs && sourceRefs.length > 0 ? formatSourceRefs(sourceRefs) : undefined;

  function handlePlay() {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    onVideoStarted();
  }

  function handleEnded() {
    if (completedRef.current) {
      return;
    }
    completedRef.current = true;
    onVideoCompleted();
  }

  return (
    <main>
      <h1>{title}</h1>
      {videoKind === "followup" ? (
        <p>This short clip focuses on the idea from the last question.</p>
      ) : null}

      {clipOriginLabel ? <p>{clipOriginLabel}</p> : null}

      {videoStatus === "preparing" ? (
        <p role="status">Preparing your video...</p>
      ) : null}

      {videoStatus === "failed" ? (
        <section aria-live="polite">
          <p role="alert">Your video could not be loaded.</p>
          <button type="button" onClick={onRetryVideo}>
            Try again
          </button>
        </section>
      ) : null}

      {videoStatus === "ready" && videoUrl ? (
        <>
          <video
            controls
            src={videoUrl}
            aria-label="Lesson video"
            onPlay={handlePlay}
            onEnded={handleEnded}
          />
          {transcript ? (
            <details aria-label="Transcript">
              <summary>Transcript</summary>
              <p>{transcript}</p>
            </details>
          ) : null}
          {sourceLabel ? <p>{sourceLabel}</p> : null}
        </>
      ) : null}

      <button type="button" disabled={!answerEnabled} onClick={onOpenQuestion}>
        Answer question
      </button>
      <button type="button" onClick={onBack}>
        Back
      </button>
    </main>
  );
}
