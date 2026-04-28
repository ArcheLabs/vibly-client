import { z } from "zod";

export const SubmitReviewSchema = z.object({
  result: z.enum(["approve", "reject", "request-changes", "abstain"]),
  rationale: z.string().min(1),
  score: z.number().min(0).max(1).optional(),
  contextBundleId: z.string().min(1),
});

export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;
