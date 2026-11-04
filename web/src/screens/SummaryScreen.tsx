import { useEffect, useRef } from "react";
import { formatSourceRefs } from "../content/sourceRefs";

type SummaryScreenProps = {
  objectiveLabel: string;
  status: "complete" | "needs_review";
  feedback?: string;
  keyPoints?: string[];
  sourceRefs?: string[];
  onGoHome(): void;
  onRestart(): void;
};

export function SummaryScreen({
  objectiveLabel,
  status,
  feedback,
  keyPoints,
  sourceRefs,
  onGoHome,
  onRestart,
}: SummaryScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  const heading =
    status === "complete" ? "Objective complete" : "Let's review this one";

  const showKeyPoints = keyPoints !== undefined && keyPoints.length > 0;
  const sourceLabel =
    sourceRefs && sourceRefs.length > 0 ? formatSourceRefs(sourceRefs) : "";

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="app-screen">
      <div
        className={`panel-hero ${status === "complete" ? "panel-hero--success" : "panel-hero--neutral"}`}
      >
        <h1 ref={headingRef} tabIndex={-1}>
          {heading}
        </h1>
        <p>{objectiveLabel}</p>
      </div>

      {status === "needs_review" ? (
        <>
          {feedback ? <p className="screen-lead">{feedback}</p> : null}
          {showKeyPoints ? (
            <section className="card key-points">
              <h2>Key points</h2>
              <ul>
                {keyPoints!.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {sourceLabel ? <p className="source-ref">{sourceLabel}</p> : null}
        </>
      ) : null}

      <div className="screen-actions">
        <button type="button" className="btn btn-secondary" onClick={onGoHome}>
          Back to home
        </button>
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          Restart this objective
        </button>
      </div>
    </main>
  );
}
