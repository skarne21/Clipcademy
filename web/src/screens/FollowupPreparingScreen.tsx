type FollowupPreparingScreenProps = {
  videoStatus: "preparing" | "failed";
  onRetryVideo(): void;
  onGoHome(): void;
};

export function FollowupPreparingScreen({
  videoStatus,
  onRetryVideo,
  onGoHome,
}: FollowupPreparingScreenProps) {
  return (
    <main>
      <h1>Preparing a short follow-up</h1>

      {videoStatus === "preparing" ? (
        <p role="status">
          A short video focused on the last question is being prepared.
        </p>
      ) : null}

      {videoStatus === "failed" ? (
        <section aria-live="polite">
          <p role="alert">The follow-up video couldn&apos;t be prepared.</p>
          <p>Your answer is saved—you can try again or go back home.</p>
          <button type="button" onClick={onRetryVideo}>
            Try again
          </button>
        </section>
      ) : null}

      <button type="button" onClick={onGoHome}>
        Back to home
      </button>
    </main>
  );
}
