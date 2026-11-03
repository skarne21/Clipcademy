import type { RemediationState, Topic } from "../api/types";

type ReviewHomeScreenProps = {
  topics: Topic[];
  selectedIds: string[];
  remediationStates: Record<string, RemediationState>;
  isStartable(objectiveId: string): boolean;
  canResume: boolean;
  onOpenObjective(topicId: string, objectiveId: string): void;
  onResume(): void;
  onChangeTopics(): void;
};

function statusText(
  objectiveLabel: string,
  remediation: RemediationState | undefined,
): string {
  if (!remediation) {
    return "Not started";
  }
  switch (remediation.objective_status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "complete":
      return `Objective complete: ${objectiveLabel}`;
    case "needs_review":
      return "Needs review";
    default:
      return "Not started";
  }
}

export function ReviewHomeScreen({
  topics,
  selectedIds,
  remediationStates,
  isStartable,
  canResume,
  onOpenObjective,
  onResume,
  onChangeTopics,
}: ReviewHomeScreenProps) {
  const selectedTopics = topics.filter((topic) =>
    selectedIds.includes(topic.topic_id),
  );

  return (
    <main>
      <h1>Review home</h1>
      {canResume ? (
        <button type="button" onClick={onResume}>
          Resume
        </button>
      ) : null}
      <button type="button" onClick={onChangeTopics}>
        Change topics
      </button>

      {selectedTopics.map((topic) => (
        <section key={topic.topic_id} aria-labelledby={`topic-${topic.topic_id}`}>
          <h2 id={`topic-${topic.topic_id}`}>{topic.label}</h2>

          {topic.availability === "coming_soon" ? (
            <p>Coming soon</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {topic.objectives.map((objective) => {
                const remediation = remediationStates[objective.objective_id];
                const startable = isStartable(objective.objective_id);
                return (
                  <li key={objective.objective_id}>
                    <section aria-label={objective.label}>
                      <h3>{objective.label}</h3>
                      <p>{statusText(objective.label, remediation)}</p>
                      {startable ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenObjective(topic.topic_id, objective.objective_id)
                          }
                        >
                          Start, {objective.label}
                        </button>
                      ) : (
                        <p>Coming soon</p>
                      )}
                    </section>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </main>
  );
}
