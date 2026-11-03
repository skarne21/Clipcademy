import { createDefaultAppDeps, type AppDeps } from "./app/deps";
import { useAppController } from "./app/useAppController";
import { ParticipantCodeScreen } from "./screens/ParticipantCodeScreen";
import { ReviewHomeScreen } from "./screens/ReviewHomeScreen";
import { TopicPickerScreen } from "./screens/TopicPickerScreen";

type AppProps = {
  deps?: AppDeps;
};

function App({ deps }: AppProps) {
  const resolvedDeps = deps ?? createDefaultAppDeps();
  const controller = useAppController(resolvedDeps);

  let screen = null;
  switch (controller.nav.screen) {
    case "participant_code":
      screen = (
        <ParticipantCodeScreen onSubmit={controller.onParticipantSubmit} />
      );
      break;
    case "topics":
      screen = (
        <TopicPickerScreen
          topics={controller.topics}
          error={controller.topicsError}
          selectedIds={controller.progressSnapshot.selected_topic_ids}
          onToggle={controller.onTopicToggle}
          onConfirm={controller.onTopicsConfirm}
          onRetry={() => {
            void controller.loadTopicsList();
          }}
        />
      );
      break;
    case "home":
      screen = (
        <ReviewHomeScreen
          topics={controller.topics ?? []}
          selectedIds={controller.progressSnapshot.selected_topic_ids}
          remediationStates={controller.progressSnapshot.remediation_states}
          isStartable={controller.isStartable}
          canResume={false}
          onOpenObjective={controller.onOpenObjective}
          onResume={controller.onResume}
          onChangeTopics={controller.onChangeTopics}
        />
      );
      break;
    default:
      screen = <p>Screen not implemented yet: {controller.nav.screen}</p>;
      break;
  }

  return (
    <>
      <header>
        <h1>Clipcademy</h1>
        <button type="button" onClick={controller.onResetDemo}>
          Reset demo
        </button>
      </header>
      {screen}
    </>
  );
}

export default App;
