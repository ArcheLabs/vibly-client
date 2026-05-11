import { z } from "zod";

export const ObservationResultSchema = z.object({
  summary: z.string().min(1),
  findings: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
  })).optional(),
  risks: z.array(z.unknown()).optional(),
  suggestedActions: z.array(z.object({
    type: z.string(),
    title: z.string(),
    description: z.string().optional(),
  })).optional(),
  artifactUri: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type ObservationResultInput = z.infer<typeof ObservationResultSchema>;

export const AcceptAssignmentSchema = z.object({
  assignmentOfferId: z.string().min(1),
});

export type AcceptAssignmentInput = z.infer<typeof AcceptAssignmentSchema>;
