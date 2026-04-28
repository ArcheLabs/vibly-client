import { z } from "zod";

export const AutoVoteRuleSchema = z.object({
  /** Pattern to match negotiation topic (regex or exact) */
  topicPattern: z.string().optional(),
  stance: z.enum(["support", "oppose", "abstain"]),
  maxRiskLevel: z.enum(["low", "medium"]).default("medium"),
});

export const DaemonConfigSchema = z.object({
  intervalMs: z.number().int().positive().default(30000),
  autoClaim: z.boolean().default(false),
  autoRun: z.boolean().default(false),
  autoSubmit: z.boolean().default(false),
  autoVote: z.boolean().default(false),
  autoReview: z.boolean().default(false),
  autoClaimRewards: z.boolean().default(false),
  autoVoteRules: z.array(AutoVoteRuleSchema).default([]),
  maxConcurrentRuns: z.number().int().positive().default(1),
});

export type DaemonConfig = z.infer<typeof DaemonConfigSchema>;
export type AutoVoteRule = z.infer<typeof AutoVoteRuleSchema>;
