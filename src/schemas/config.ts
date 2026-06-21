import { z } from "zod";

const NetworkFeatureSchema = z.object({
  agentJoin: z.boolean(),
  daemon: z.boolean(),
  staking: z.boolean(),
  rootIdentityRegistration: z.boolean(),
});

const NetworkChainSchema = z.object({
  chainId: z.string(),
  genesisHash: z.string().optional(),
  rpcUrls: z.array(z.string()).default([]),
  tokenSymbol: z.string().optional(),
  tokenDecimals: z.number().int().nonnegative().optional(),
  explorerTxUrl: z.string().optional(),
  status: z.string().optional(),
});

const NetworkProfileSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  label: z.string().optional(),
  stage: z.string().optional(),
  status: z.string().optional(),
  manifestVersion: z.number().optional(),
  updatedAt: z.string().optional(),
  ttlSeconds: z.number().optional(),
  lastSyncedAt: z.string().optional(),
  viblyGenesisHash: z.string().optional(),
  coordinatorUrl: z.string().url(),
  coordinatorUrls: z.array(z.string().url()).optional(),
  relayRpcUrl: z.string().optional(),
  relayRpcUrls: z.array(z.string()).optional(),
  relayGenesisHash: z.string().optional(),
  relayTokenSymbol: z.string().optional(),
  relayTokenDecimals: z.number().optional(),
  viblyRpcUrl: z.string().optional(),
  viblyRpcUrls: z.array(z.string()).optional(),
  chains: z.object({
    vibly: NetworkChainSchema.optional(),
  }).optional(),
  features: NetworkFeatureSchema.optional(),
  messages: z.record(z.string()).optional(),
});

export const ProfileSchema = z.object({
  name: z.string().min(1),
  coordinatorUrl: z.string().url(),
  network: NetworkProfileSchema.optional(),
  principalId: z.string().optional(),
  agentId: z.string().optional(),
  localAgentId: z.string().optional(),
  identityId: z.string().optional(),
  chainAgentId: z.string().optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  defaultRuntimeBindingId: z.string().optional(),
  apiTokenRef: z.string().optional(),
  wallet: z.object({
    publicAddress: z.string().optional(),
    chain: z.string().optional(),
    setAt: z.string().optional(),
  }).optional(),
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
