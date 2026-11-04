import type { RemediationState, Topic } from "../api/types";

type ReviewHomeScreenProps = {
  topics: Topic[];
  selectedIds: string[];
  remediationStates: Record<string, RemediationState>;
  isStartable(objectiveId: string): boolean;
  canResume: boolean;
  onOpenObjective(topicId: string, objectiveId: string): void;
  onReviewObjectiveAgain(topicId: string, objectiveId: string): void;
  onResume(): void;
  onChangeTopics(): void;
};

function statusText(
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
      return "Objective complete.";
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
  onReviewObjectiveAgain,
  onResume,
  onChangeTopics,
}: ReviewHomeScreenProps) {
  const selectedTopics = topics.filter((topic) =>
    selectedIds.includes(topic.topic_id),
  );

  return (
    <main className="app-screen">
      <h1>Review home</h1>
      <p className="screen-lead">
        Pick an objective to watch a lesson and answer practice questions.
      </p>
      <div className="toolbar-row">
        {canResume ? (
          <button type="button" className="btn btn-primary" onClick={onResume}>
            Resume
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={onChangeTopics}>
          Change topics
        </button>
      </div>

      {selectedTopics.map((topic) => (
        <section
          key={topic.topic_id}
          className="card-section"
          aria-labelledby={`topic-${topic.topic_id}`}
        >
          <h2 id={`topic-${topic.topic_id}`}>{topic.label}</h2>

          {topic.availability === "coming_soon" ? (
            <p className="badge badge-muted">Coming soon</p>
          ) : (
            <ul className="card-grid">
              {topic.objectives.map((objective) => {
                const remediation = remediationStates[objective.objective_id];
                const startable = isStartable(objective.objective_id);
                const status = statusText(remediation);
                const isComplete = remediation?.objective_status === "complete";
                return (
                  <li key={objective.objective_id}>
                    <section
                      className="card objective-card"
                      aria-label={objective.label}
                    >
                      <h3>{objective.label}</h3>
                      {startable ? (
                        <>
                          <p className="status-line">{status}</p>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() =>
                              isComplete
                                ? onReviewObjectiveAgain(
                                    topic.topic_id,
                                    objective.objective_id,
                                  )
                                : onOpenObjective(
                                    topic.topic_id,
                                    objective.objective_id,
                                  )
                            }
                          >
                            {isComplete
                              ? "Review again"
                              : `Start, ${objective.label}`}
                          </button>
                        </>
                      ) : (
                        <span className="badge badge-muted">Coming soon</span>
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
