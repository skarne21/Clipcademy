export class LlmRefusalError extends Error {
  readonly refusal: string;

  constructor(refusal: string) {
    super(`Model refused: ${refusal}`);
    this.name = "LlmRefusalError";
    this.refusal = refusal;
  }
}

export class LlmStructuredOutputError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "LlmStructuredOutputError";
    this.details = details;
  }
}
