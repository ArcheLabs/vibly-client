import { z } from "zod";

export const SubmitVoteSchema = z.object({
  stance: z.enum(["support", "oppose", "abstain", "revise", "escalate"]),
  rationale: z.string().min(1),
  score: z.number().min(0).max(1).optional(),
});

export type SubmitVoteInput = z.infer<typeof SubmitVoteSchema>;
