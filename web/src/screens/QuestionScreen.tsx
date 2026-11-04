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
    <main className="app-screen">
      {loadError ? (
        <section className="alert" aria-live="polite">
          <p role="alert">{loadError}</p>
          <div className="screen-actions">
            <button type="button" className="btn btn-secondary" onClick={onRetryLoad}>
              Try again
            </button>
          </div>
        </section>
      ) : null}

      {!loadError && question === null ? (
        <p className="status-message" role="status" aria-label="Loading question">
          Loading question…
        </p>
      ) : null}

      {!loadError && question !== null ? (
        <form onSubmit={handleSubmit}>
          <fieldset className="choice-list">
            <legend>{question.prompt}</legend>
            {question.choices.map((choice) => {
              const inputId = `choice-${question.question_id}-${choice.choice_id}`;
              return (
                <div key={choice.choice_id} className="choice-option">
                  <label htmlFor={inputId}>
                    <input
                      id={inputId}
                      type="radio"
                      name={`question-${question.question_id}`}
                      value={choice.choice_id}
                      checked={selectedChoiceId === choice.choice_id}
                      disabled={submitting}
                      onChange={() => setSelectedChoiceId(choice.choice_id)}
                    />
                    {choice.text}
                  </label>
                </div>
              );
            })}
          </fieldset>

          {submitError ? (
            <div className="alert">
              <p role="alert">{submitError}</p>
            </div>
          ) : null}

          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            Submit
          </button>
        </form>
      ) : null}

      <div className="screen-actions">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </main>
  );
}
