import type { Topic } from "../api/types";

export const topics: Topic[] = [
  {
    topic_id: "dna_replication",
    label: "DNA Replication",
    source_refs: ["L19-p1", "L19-p2", "L19-p3"],
    availability: "available",
    objectives: [
      {
        objective_id: "synthesis_direction_and_primer",
        label: "Synthesis direction and primer requirement",
      },
    ],
  },
  {
    topic_id: "dna_repair",
    label: "DNA Repair",
    source_refs: ["L20-p1"],
    availability: "available",
    objectives: [
      {
        objective_id: "error_correction",
        label: "Error correction mechanisms",
      },
    ],
  },
  {
    topic_id: "transcription",
    label: "Transcription",
    source_refs: ["L21-p1"],
    availability: "coming_soon",
    objectives: [],
  },
  {
    topic_id: "translation",
    label: "Translation",
    source_refs: ["L22-p1", "L22-p2"],
    availability: "coming_soon",
    objectives: [],
  },
];
