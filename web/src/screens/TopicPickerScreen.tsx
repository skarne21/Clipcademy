import type { Topic } from "../api/types";

type TopicPickerScreenProps = {
  topics: Topic[] | null;
  error: string | null;
  selectedIds: string[];
  onToggle(topicId: string): void;
  onConfirm(): void;
  onRetry(): void;
};

function lectureLabelFromSourceRefs(sourceRefs: string[]): string {
  const ref = sourceRefs[0];
  if (!ref) {
    return "";
  }
  const match = /^L(\d+)/.exec(ref);
  if (match) {
    return `Lecture ${match[1]}`;
  }
  return ref;
}

export function TopicPickerScreen({
  topics,
  error,
  selectedIds,
  onToggle,
  onConfirm,
  onRetry,
}: TopicPickerScreenProps) {
  const canContinue = selectedIds.length > 0;

  return (
    <main className="app-screen">
      <h1>Which topics are on your exam?</h1>
      <p className="screen-lead">
        Select the topics you want to review. This app does not know your exam
        schedule or coverage—you choose what to practice.
      </p>

      {error ? (
        <section className="alert" aria-live="polite">
          <p role="alert">{error}</p>
          <div className="screen-actions">
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              Retry
            </button>
          </div>
        </section>
      ) : null}

      {!error && topics === null ? (
        <p className="status-message" role="status" aria-label="Loading topics">
          Loading topics…
        </p>
      ) : null}

      {!error && topics !== null ? (
        <>
          <ul className="card-grid">
            {topics.map((topic) => {
              const isComingSoon = topic.availability === "coming_soon";
              const checkboxId = `topic-${topic.topic_id}`;
              const lectureLabel = lectureLabelFromSourceRefs(topic.source_refs);
              return (
                <li key={topic.topic_id}>
                  <article className="card topic-card" aria-label={topic.label}>
                    <label htmlFor={checkboxId}>
                      <input
                        id={checkboxId}
                        type="checkbox"
                        aria-label={topic.label}
                        checked={selectedIds.includes(topic.topic_id)}
                        disabled={isComingSoon}
                        onChange={() => {
                          if (!isComingSoon) {
                            onToggle(topic.topic_id);
                          }
                        }}
                      />
                      <span className="topic-card__content">
                        <h2>{topic.label}</h2>
                        {lectureLabel ? (
                          <p className="topic-card__meta">{lectureLabel}</p>
                        ) : null}
                        {isComingSoon ? (
                          <span className="badge badge-muted">Coming soon</span>
                        ) : null}
                      </span>
                    </label>
                  </article>
                </li>
              );
            })}
          </ul>
          <div className="screen-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canContinue}
              onClick={onConfirm}
            >
              Continue
            </button>
          </div>
        </>
      ) : null}
    </main>
  );
}
