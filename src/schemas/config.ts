import { z } from "zod";

export const ProfileSchema = z.object({
  name: z.string().min(1),
  coordinatorUrl: z.string().url(),
  principalId: z.string().optional(),
  agentId: z.string().optional(),
  localAgentId: z.string().optional(),
  identityId: z.string().optional(),
  chainAgentId: z.string().optional(),
  projectId: z.string().optional(),
  defaultRuntimeBindingId: z.string().optional(),
  apiTokenRef: z.string().optional(),
  sync: z
    .object({
      enableSse: z.boolean().optional(),
      pollIntervalMs: z.number().int().positive().optional(),
    })
    .optional(),
  daemon: z
    .object({
      autoClaim: z.boolean().optional().default(false),
      autoRun: z.boolean().optional().default(false),
      autoSubmit: z.boolean().optional().default(false),
      autoVote: z.boolean().optional().default(false),
      autoReview: z.boolean().optional().default(false),
      autoClaimRewards: z.boolean().optional().default(false),
      deterministicE2E: z.boolean().optional().default(false),
      llmE2E: z.boolean().optional().default(false),
      maxConcurrentWork: z.number().int().positive().optional().default(1),
      allowedWorkTypes: z.array(z.string()).optional(),
      deniedWorkTypes: z.array(z.string()).optional(),
      requireManualApprovalForRisk: z
        .array(z.enum(["low", "medium", "high", "critical"]))
        .optional(),
    })
    .optional(),
});

export const ClientConfigSchema = z.object({
  version: z.string(),
  defaultProfile: z.string(),
  profiles: z.record(z.string(), ProfileSchema),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;
export type ClientConfigInput = z.infer<typeof ClientConfigSchema>;
