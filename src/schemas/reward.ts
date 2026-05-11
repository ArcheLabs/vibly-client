import { z } from "zod";

export const ClaimRewardIntentSchema = z.object({
  rewardIntentId: z.string().min(1),
});

export type ClaimRewardIntentInput = z.infer<typeof ClaimRewardIntentSchema>;
