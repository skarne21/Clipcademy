// TEMPORARY: replace with backend data when Member 2 adds first_question_id and the initial video request to GET /topics. Delete this file in Phase 7.

import type { VideoRequest } from "../api/types";

export type ObjectiveStart = {
  first_question_id: string;
  initial_video_request: VideoRequest;
};

// TODO: confirm initial variant_id with Member 1
const SYNTHESIS_DIRECTION_AND_PRIMER: ObjectiveStart = {
  first_question_id: "rep-q1",
  initial_video_request: {
    topic_id: "dna_replication",
    objective_id: "synthesis_direction_and_primer",
    variant_id: "initial",
    teaching_goal: "Explain DNA synthesis direction and why a primer is needed",
    source_refs: ["L19-p1", "L19-p2"],
  },
};

const OBJECTIVE_STARTS: Readonly<Record<string, ObjectiveStart>> = {
  synthesis_direction_and_primer: SYNTHESIS_DIRECTION_AND_PRIMER,
};

export function getObjectiveStart(objectiveId: string): ObjectiveStart | null {
  return OBJECTIVE_STARTS[objectiveId] ?? null;
}
