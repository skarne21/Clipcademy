import { useRef, useState, type FormEvent } from "react";

type ParticipantCodeScreenProps = {
  onSubmit(code: string): void;
};

export function ParticipantCodeScreen({ onSubmit }: ParticipantCodeScreenProps) {
  const [value, setValue] = useState("");
  const submittedRef = useRef(false);

  const trimmed = value.trim();
  const canContinue = trimmed.length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue || submittedRef.current) {
      return;
    }
    submittedRef.current = true;
    onSubmit(trimmed);
  }

  return (
    <main className="app-screen">
      <h1>Welcome</h1>
      <p className="screen-lead">
        Enter the participant code provided by the study team. It links your
        activity in this app to your participation in the study.
      </p>
      <form className="form-stack" onSubmit={handleSubmit}>
        <div>
          <label className="field-label" htmlFor="participant-code">
            Participant code
          </label>
          <input
            id="participant-code"
            className="text-input"
            name="participant-code"
            type="text"
            autoComplete="off"
            maxLength={32}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <div className="screen-actions">
          <button type="submit" className="btn btn-primary" disabled={!canContinue}>
            Continue
          </button>
        </div>
      </form>
    </main>
  );
}
