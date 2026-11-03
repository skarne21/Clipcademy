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
    <main>
      <h1 ref={headingRef} tabIndex={-1}>
        {heading}
      </h1>
      <p>{objectiveLabel}</p>

      {status === "needs_review" ? (
        <>
          {feedback ? <p>{feedback}</p> : null}
          {showKeyPoints ? (
            <section>
              <h2>Key points</h2>
              <ul>
                {keyPoints!.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {sourceLabel ? <p>{sourceLabel}</p> : null}
        </>
      ) : null}

      <button type="button" onClick={onGoHome}>
        Back to home
      </button>
      <button type="button" onClick={onRestart}>
        Restart this objective
      </button>
    </main>
  );
}
