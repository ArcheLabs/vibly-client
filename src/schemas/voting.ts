import { z } from "zod";

export const SubmitVoteSchema = z.object({
  choice: z.enum(["support", "oppose", "abstain"]),
  rationale: z.string().optional(),
  weight: z.string().optional(),
});

export type SubmitVoteInput = z.infer<typeof SubmitVoteSchema>;
