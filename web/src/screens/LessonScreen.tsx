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
    <main className="app-screen">
      <h1>{title}</h1>
      {videoKind === "followup" ? (
        <p className="screen-lead">
          This short clip focuses on the idea from the last question.
        </p>
      ) : null}

      {clipOriginLabel ? <p className="source-ref">{clipOriginLabel}</p> : null}

      {videoStatus === "preparing" ? (
        <p className="status-message" role="status">
          Preparing your video...
        </p>
      ) : null}

      {videoStatus === "failed" ? (
        <section className="alert" aria-live="polite">
          <p role="alert">Your video could not be loaded.</p>
          <div className="screen-actions">
            <button type="button" className="btn btn-secondary" onClick={onRetryVideo}>
              Try again
            </button>
          </div>
        </section>
      ) : null}

      {videoStatus === "ready" && videoUrl ? (
        <>
          <div className="video-panel">
            <video
              controls
              src={videoUrl}
              aria-label="Lesson video"
              onPlay={handlePlay}
              onEnded={handleEnded}
            />
          </div>
          {transcript ? (
            <details className="transcript-details" aria-label="Transcript">
              <summary>Transcript</summary>
              <p>{transcript}</p>
            </details>
          ) : null}
          {sourceLabel ? <p className="source-ref">{sourceLabel}</p> : null}
        </>
      ) : null}

      <div className="screen-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!answerEnabled}
          onClick={onOpenQuestion}
        >
          Answer question
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </main>
  );
}
