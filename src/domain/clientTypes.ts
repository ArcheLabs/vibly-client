/** Risk levels used for auto-execution policy */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/** Result returned by daemon handlers */
export interface HandlerResult {
  handled: boolean;
  action?: string;
  reason?: string;
  artifacts?: Array<{ uri: string; hash?: string; mediaType?: string }>;
  error?: unknown;
}

/** Input to RuntimeHost.execute() */
export interface RuntimeExecutionInput {
  agentId: string;
  runtimeBindingId: string;
  workOrderId: string;
  workOrderJson: string;
  contextBundleJson: string;
  contextReceiptJson: string;
  localKnowledgePath?: string;
  workingDirectory: string;
}

/** Result from RuntimeHost.execute() */
export interface RuntimeExecutionResult {
  status: "success" | "failed" | "partial";
  summary: string;
  artifacts: Array<{ uri: string; hash?: string; mediaType?: string }>;
  stdout?: string;
  stderr?: string;
  startedAt: string;
  finishedAt: string;
  outputHash?: string;
  executionReceipt: ExecutionReceiptData;
}

/** Local ExecutionReceipt structure */
export interface ExecutionReceiptData {
  runtimeId: string;
  actorId: string;
  agentId?: string;
  runtimeBindingId?: string;
  startedAt: string;
  finishedAt: string;
  inputContextBundleId: string;
  toolCalls?: string[];
  outputHash?: string;
  status: "success" | "failed" | "partial";
}

/** Local client profile */
export interface ClientProfile {
  name: string;
  coordinatorUrl: string;
  principalId?: string;
  agentId?: string;
  projectId?: string;
  defaultRuntimeBindingId?: string;
  apiTokenRef?: string;
  sync?: {
    enableSse?: boolean;
    pollIntervalMs?: number;
  };
  daemon?: {
    autoClaim?: boolean;
    autoRun?: boolean;
    autoSubmit?: boolean;
    autoVote?: boolean;
    autoReview?: boolean;
    autoClaimRewards?: boolean;
    maxConcurrentWork?: number;
    allowedWorkTypes?: string[];
    deniedWorkTypes?: string[];
    requireManualApprovalForRisk?: RiskLevel[];
  };
}

/** Local config.json shape */
export interface ClientConfig {
  version: string;
  defaultProfile: string;
  profiles: Record<string, ClientProfile>;
}

/** Local runtime registration */
export interface LocalRuntimeConfig {
  id: string;
  name: string;
  runtimeType: "script" | "mock" | "human_assisted";
  command?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  capabilities?: string[];
  agentId?: string;
  runtimeBindingId?: string;
  registeredAt: string;
}
