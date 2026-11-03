import type { Question } from "../api/types";

export const repQ1: Question = {
  question_id: "rep-q1",
  objective_id: "synthesis_direction_and_primer",
  prompt: "Which end receives new nucleotides during DNA synthesis?",
  choices: [
    { choice_id: "A", text: "5′ end" },
    { choice_id: "B", text: "3′ end" },
  ],
};

export const questions: Record<string, Question> = {
  "rep-q1": repQ1,
};
