import { z } from "zod";

const uiOnly = () => {
  throw new Error("UI-only prototype: API calls are not available.");
};

export const AnalyzeRequestSchema = z.object({
  original_text: z.string().min(1),
  student_transcript: z.string().optional().default(""),
  miscue_list: z.string().optional().default(""),
  word_count: z.number().int().nonnegative(),
  seconds_taken: z.number().positive(),
  comprehension_score: z.number().min(0).max(100),
  frontend_miscue_count: z.number().int().nonnegative().default(0),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const AnalyzeResponseSchema = z.object({
  wcpm: z.number(),
  accuracy_rate: z.number(),
  comprehension_score: z.number(),
  level: z.enum(["Frustrational", "Instructional", "Independent"]),
  level_by_accuracy: z.enum(["Frustrational", "Instructional", "Independent"]),
  level_by_wcpm: z.enum(["Frustrational", "Instructional", "Independent"]),
  data_quality: z.object({
    transcript_present: z.boolean(),
    miscues_present: z.boolean(),
    notes: z.string(),
  }),
  miscues: z.array(
    z.object({
      original_word: z.string(),
      student_said: z.string(),
      type: z.enum(["omission", "substitution", "mispronunciation"]),
      pattern: z.enum(["phonetic", "visual", "semantic"]),
    }),
  ),
  gap: z.string(),
  pattern_summary: z.string(),
  strengths: z.array(z.string()),
  areas_for_improvement: z.array(
    z.object({
      issue: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    }),
  ),
  intervention: z.object({
    exercise_type: z.enum([
      "fill_blank",
      "word_match",
      "reread",
      "phonics_drill",
    ]),
    target_skill: z.string(),
    instructions: z.string(),
    content: z.array(z.string()),
    mastery_check_questions: z.array(z.string()),
  }),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export const MasteryCheckRequestSchema = z.object({
  level: z.enum(["Frustrational", "Instructional", "Independent"]),
  target_skill: z.string().min(1),
  gap: z.string().min(1),
  mastery_questions: z.array(z.string()).min(1),
  student_answers: z.array(z.string()).min(1),
});
export type MasteryCheckRequest = z.infer<typeof MasteryCheckRequestSchema>;

export const MasteryCheckResponseSchema = z.object({
  mastery_achieved: z.boolean(),
  score: z.string(),
  question_results: z.array(
    z.object({
      question: z.string(),
      student_answer: z.string(),
      is_correct: z.boolean(),
      feedback: z.string(),
    }),
  ),
  overall_feedback: z.string(),
  next_action: z.enum(["promote", "repeat_different", "repeat_simpler"]),
});
export type MasteryCheckResponse = z.infer<typeof MasteryCheckResponseSchema>;

export const InterventionSchema = z.object({
  exercise_type: z.enum([
    "fill_blank",
    "word_match",
    "reread",
    "phonics_drill",
  ]),
  target_skill: z.string(),
  instructions: z.string(),
  content: z.array(z.string()),
  mastery_check_questions: z.array(z.string()),
});
export type Intervention = z.infer<typeof InterventionSchema>;

export const RegenerateInterventionRequestSchema = z.object({
  level: z.enum(["Frustrational", "Instructional", "Independent"]),
  target_skill: z.string().min(1),
  gap: z.string().min(1),
  previous_exercise_type: z.enum([
    "fill_blank",
    "word_match",
    "reread",
    "phonics_drill",
  ]),
  previous_content: z.array(z.string()),
  next_action: z.enum(["repeat_different", "repeat_simpler"]),
});
export type RegenerateInterventionRequest = z.infer<
  typeof RegenerateInterventionRequestSchema
>;

export const TeacherSummaryRequestSchema = z.object({
  class_summary_json: z.unknown(),
});
export type TeacherSummaryRequest = z.infer<typeof TeacherSummaryRequestSchema>;

export const TeacherSummaryResponseSchema = z.object({
  class_health: z.object({
    frustrational_count: z.number().int(),
    instructional_count: z.number().int(),
    independent_count: z.number().int(),
    total_students: z.number().int(),
  }),
  urgent_attention: z.array(
    z.object({
      student_name: z.string(),
      reason: z.string(),
    }),
  ),
  most_common_gap: z.string(),
  group_activity_suggestion: z.string(),
  summary_text: z.string(),
});
export type TeacherSummaryResponse = z.infer<
  typeof TeacherSummaryResponseSchema
>;

export const ResiliencePackRequestSchema = z.object({
  days: z.number().int().min(1).max(14),
  level: z.enum(["Frustrational", "Instructional", "Independent"]),
  gap: z.string().optional(),
});
export type ResiliencePackRequest = z.infer<typeof ResiliencePackRequestSchema>;

export const ResiliencePackResponseSchema = z.object({
  days: z.number().int(),
  level: z.enum(["Frustrational", "Instructional", "Independent"]),
  items: z.array(
    z.object({
      day: z.number().int(),
      title: z.string(),
      passage: z.string(),
      questions: z.array(
        z.object({
          q: z.string(),
          choices: z.array(z.string()).length(4),
          answer: z.number().int().min(0).max(3),
        }),
      ),
      exercise: z.object({
        exercise_type: z.enum([
          "fill_blank",
          "word_match",
          "phonics_drill",
          "reread",
        ]),
        instructions: z.string(),
        content: z.array(z.string()),
      }),
    }),
  ),
});
export type ResiliencePackResponse = z.infer<
  typeof ResiliencePackResponseSchema
>;

export const kinaiyaApi = {
  analyze: (_req: AnalyzeRequest) => uiOnly(),
  masteryCheck: (_req: MasteryCheckRequest) => uiOnly(),
  regenerateIntervention: (_req: RegenerateInterventionRequest) => uiOnly(),
  teacherSummary: (_req: TeacherSummaryRequest) => uiOnly(),
  resiliencePack: (_req: ResiliencePackRequest) => uiOnly(),
};

export const getStudentFriendlyLevel = (level: string): string => {
  switch (level) {
    case "Frustrational":
      return "Exploring";
    case "Instructional":
      return "Growing";
    case "Independent":
      return "Fluent";
    default:
      return level;
  }
};
