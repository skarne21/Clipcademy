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
    <main>
      <h1>Which topics are on your exam?</h1>
      <p>
        Select the topics you want to review. This app does not know your exam
        schedule or coverage—you choose what to practice.
      </p>

      {error ? (
        <section aria-live="polite">
          <p role="alert">{error}</p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </section>
      ) : null}

      {!error && topics === null ? (
        <p role="status" aria-label="Loading topics">
          Loading topics…
        </p>
      ) : null}

      {!error && topics !== null ? (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {topics.map((topic) => {
              const isComingSoon = topic.availability === "coming_soon";
              const checkboxId = `topic-${topic.topic_id}`;
              return (
                <li key={topic.topic_id}>
                  <article aria-label={topic.label}>
                    <h2>{topic.label}</h2>
                    <p>{lectureLabelFromSourceRefs(topic.source_refs)}</p>
                    {isComingSoon ? <p>Coming soon</p> : null}
                    <label htmlFor={checkboxId}>{topic.label}</label>
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={selectedIds.includes(topic.topic_id)}
                      disabled={isComingSoon}
                      onChange={() => {
                        if (!isComingSoon) {
                          onToggle(topic.topic_id);
                        }
                      }}
                    />
                  </article>
                </li>
              );
            })}
          </ul>
          <button type="button" disabled={!canContinue} onClick={onConfirm}>
            Continue
          </button>
        </>
      ) : null}
    </main>
  );
}
