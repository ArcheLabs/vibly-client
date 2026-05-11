import { z } from "zod";

export const SubmitProposalSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  rationale: z.string().optional(),
  targetObjectiveId: z.string().optional(),
});

export type SubmitProposalInput = z.infer<typeof SubmitProposalSchema>;
