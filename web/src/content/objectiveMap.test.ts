import { describe, expect, it } from "vitest";
import { getObjectiveStart } from "./objectiveMap";

describe("getObjectiveStart", () => {
  it("returns first question and initial video request for synthesis_direction_and_primer", () => {
    const start = getObjectiveStart("synthesis_direction_and_primer");
    expect(start).not.toBeNull();
    expect(start!.first_question_id).toBe("rep-q1");
    expect(start!.initial_video_request).toEqual({
      topic_id: "dna_replication",
      objective_id: "synthesis_direction_and_primer",
      variant_id: "initial",
      teaching_goal: "Explain DNA synthesis direction and why a primer is needed",
      source_refs: ["L19-p1", "L19-p2"],
    });
  });

  it("returns null for an unknown objective id", () => {
    expect(getObjectiveStart("does_not_exist")).toBeNull();
  });

  it("returns null for error_correction (not mapped yet)", () => {
    expect(getObjectiveStart("error_correction")).toBeNull();
  });
});
