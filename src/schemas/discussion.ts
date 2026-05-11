import { z } from "zod";

export const DiscussionContributionSchema = z.object({
  content: z.string().min(1),
  contentFormat: z.enum(["markdown", "text"]).default("markdown"),
  tags: z.array(z.string()).optional(),
});

export type DiscussionContributionInput = z.infer<typeof DiscussionContributionSchema>;
