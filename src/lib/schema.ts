import { z } from "zod";

// =====================================================================
// Zod schemas — single source of truth for what the LLM must return
// and what the API accepts as input.
// =====================================================================

// LLM extraction result
export const ExtractedDecision = z.object({
  decision: z.string().min(1),
  rationale: z.string().nullable().optional(),
  source_quote: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export const ExtractedActionItem = z.object({
  task: z.string().min(1),
  owner: z.string().nullable().optional(),
  // Accept either "YYYY-MM-DD" or null. The LLM is told to use ISO dates only.
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "deadline must be YYYY-MM-DD")
    .nullable()
    .optional(),
  source_quote: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export const ExtractedOpenQuestion = z.object({
  question: z.string().min(1),
  context: z.string().nullable().optional(),
  source_quote: z.string().nullable().optional(),
});

export const ExtractionResult = z.object({
  title: z.string().min(1),
  decisions: z.array(ExtractedDecision).default([]),
  action_items: z.array(ExtractedActionItem).default([]),
  open_questions: z.array(ExtractedOpenQuestion).default([]),
});

export type ExtractionResultT = z.infer<typeof ExtractionResult>;

// API inputs
export const ProcessTranscriptInput = z.object({
  title: z.string().min(1).max(300).optional(),
  transcript: z.string().min(20, "transcript too short"),
  source: z.enum(["upload", "zoom", "teams", "email"]).default("upload"),
  source_ref: z.string().nullable().optional(),
  occurred_at: z.string().datetime().nullable().optional(),
});

export const PatchActionItemInput = z.object({
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
  owner: z.string().nullable().optional(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  task: z.string().min(1).optional(),
});
