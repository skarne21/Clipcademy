import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Question } from "../api/types";

type QuestionScreenProps = {
  question: Question | null;
  loadError: string | null;
  submitting: boolean;
  submitError: string | null;
  onSubmit(choiceId: string): void;
  onRetryLoad(): void;
  onBack(): void;
};

export function QuestionScreen({
  question,
  loadError,
  submitting,
  submitError,
  onSubmit,
  onRetryLoad,
  onBack,
}: QuestionScreenProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    setSelectedChoiceId(null);
    submittedRef.current = false;
  }, [question?.question_id]);

  useEffect(() => {
    if (!submitting) {
      submittedRef.current = false;
    }
  }, [submitting]);

  const canSubmit =
    selectedChoiceId !== null && !submitting && question !== null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || selectedChoiceId === null || submittedRef.current) {
      return;
    }
    submittedRef.current = true;
    onSubmit(selectedChoiceId);
  }

  return (
    <main>
      {loadError ? (
        <section aria-live="polite">
          <p role="alert">{loadError}</p>
          <button type="button" onClick={onRetryLoad}>
            Try again
          </button>
        </section>
      ) : null}

      {!loadError && question === null ? (
        <p role="status" aria-label="Loading question">
          Loading question…
        </p>
      ) : null}

      {!loadError && question !== null ? (
        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>{question.prompt}</legend>
            {question.choices.map((choice) => {
              const inputId = `choice-${question.question_id}-${choice.choice_id}`;
              return (
                <div key={choice.choice_id}>
                  <label htmlFor={inputId}>{choice.text}</label>
                  <input
                    id={inputId}
                    type="radio"
                    name={`question-${question.question_id}`}
                    value={choice.choice_id}
                    checked={selectedChoiceId === choice.choice_id}
                    disabled={submitting}
                    onChange={() => setSelectedChoiceId(choice.choice_id)}
                  />
                </div>
              );
            })}
          </fieldset>

          {submitError ? <p role="alert">{submitError}</p> : null}

          <button type="submit" disabled={!canSubmit}>
            Submit
          </button>
        </form>
      ) : null}

      <button type="button" onClick={onBack}>
        Back
      </button>
    </main>
  );
}
