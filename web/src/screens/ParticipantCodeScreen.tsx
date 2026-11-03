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
    <main>
      <p>
        Enter the participant code provided by the study team. It links your
        activity in this app to your participation in the study.
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="participant-code">Participant code</label>
        <input
          id="participant-code"
          name="participant-code"
          type="text"
          autoComplete="off"
          maxLength={32}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" disabled={!canContinue}>
          Continue
        </button>
      </form>
    </main>
  );
}
