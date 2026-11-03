import { createDefaultAppDeps, type AppDeps } from "./app/deps";
import { useAppController } from "./app/useAppController";
import { FollowupPreparingScreen } from "./screens/FollowupPreparingScreen";
import { FeedbackScreen } from "./screens/FeedbackScreen";
import { LessonScreen } from "./screens/LessonScreen";
import { ParticipantCodeScreen } from "./screens/ParticipantCodeScreen";
import { QuestionScreen } from "./screens/QuestionScreen";
import { ReviewHomeScreen } from "./screens/ReviewHomeScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
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
    case "lesson":
      screen = (
        <LessonScreen
          key={controller.nav.video_job_id ?? "pending"}
          title={controller.lessonTitle}
          videoKind={controller.nav.video_kind ?? "initial"}
          videoStatus={controller.nav.video_status ?? "preparing"}
          videoUrl={controller.lessonVideoMeta?.video_url}
          transcript={controller.lessonVideoMeta?.transcript}
          sourceRefs={controller.lessonVideoMeta?.source_refs}
          onVideoStarted={controller.onVideoStarted}
          onVideoCompleted={controller.onVideoCompleted}
          onOpenQuestion={controller.onOpenQuestion}
          onBack={controller.onGoHome}
          onRetryVideo={controller.onRetryVideo}
        />
      );
      break;
    case "question":
      screen = (
        <QuestionScreen
          question={controller.question}
          loadError={controller.questionLoadError}
          submitting={controller.nav.submitting ?? false}
          submitError={controller.submitError}
          onSubmit={controller.onQuestionSubmit}
          onRetryLoad={controller.onRetryQuestionLoad}
          onBack={controller.onGoHome}
        />
      );
      break;
    case "feedback":
      if (controller.nav.last_result) {
        screen = (
          <FeedbackScreen
            result={controller.nav.last_result}
            error={controller.nav.error}
            onContinue={controller.onFeedbackContinue}
            onGoHome={controller.onGoHome}
          />
        );
      }
      break;
    case "followup_preparing":
      if (controller.followupVideoStatus) {
        screen = (
          <FollowupPreparingScreen
            videoStatus={controller.followupVideoStatus}
            onRetryVideo={controller.onRetryVideo}
            onGoHome={controller.onGoHome}
          />
        );
      }
      break;
    case "summary": {
      const summaryResult = controller.nav.last_result;
      const summaryStatus = summaryResult?.remediation_state.objective_status;
      if (
        summaryResult &&
        (summaryStatus === "complete" || summaryStatus === "needs_review")
      ) {
        screen = (
          <SummaryScreen
            objectiveLabel={controller.lessonTitle}
            status={summaryStatus}
            feedback={summaryResult.feedback}
            keyPoints={summaryResult.key_points}
            sourceRefs={summaryResult.source_refs}
            onGoHome={controller.onGoHome}
            onRestart={controller.onRestartObjective}
          />
        );
      }
      break;
    }
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
