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
    <main className="app-screen">
      <h1>Preparing a short follow-up</h1>

      {videoStatus === "preparing" ? (
        <p className="status-message" role="status">
          A short video focused on the last question is being prepared.
        </p>
      ) : null}

      {videoStatus === "failed" ? (
        <section className="alert" aria-live="polite">
          <p role="alert">The follow-up video couldn&apos;t be prepared.</p>
          <p>Your answer is saved—you can try again or go back home.</p>
          <div className="screen-actions">
            <button type="button" className="btn btn-secondary" onClick={onRetryVideo}>
              Try again
            </button>
          </div>
        </section>
      ) : null}

      <div className="screen-actions">
        <button type="button" className="btn btn-ghost" onClick={onGoHome}>
          Back to home
        </button>
      </div>
    </main>
  );
}
