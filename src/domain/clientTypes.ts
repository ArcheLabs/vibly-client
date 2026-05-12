/** Risk levels used for auto-execution policy */
export type RiskLevel = "low" | "medium" | "high" | "critical";

// ─── ActionIntent ─────────────────────────────────────────────────────────────

export interface ActionIntentInput {
  type: string;
  principalId: string;
  organizationId?: string;
  projectId?: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface ActionIntentReceipt {
  eventId: string;
  aggregateRef: { kind: string; id: string };
  status: "accepted";
  events: unknown[];
}

export interface AgentInbox {
  principalId: string;
  agent?: Record<string, unknown>;
  assignmentOffers?: Array<Record<string, unknown>>;
  discussionParticipations?: Array<Record<string, unknown>>;
  reviewRequests?: Array<Record<string, unknown>>;
  availableTasks?: Array<Record<string, unknown>>;
  notifications?: Array<Record<string, unknown>>;
  knowledgeSnapshot?: { entries?: Array<Record<string, unknown>>; version?: number };
  rewardIntents?: Array<Record<string, unknown>>;
}

// ─── v0.2 Snapshot types ─────────────────────────────────────────────────────

export interface OrganizationSnapshot {
  id: string;
  name: string;
  description?: string;
  status: string;
  memberCount?: number;
  handbook?: unknown;
  members?: unknown[];
  authorities?: unknown[];
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectHandbookSnapshot {
  projectId: string;
  content: unknown;
  updatedAt: string;
}

export interface MechanismSnapshot {
  id: string;
  organizationId: string;
  projectId?: string;
  name: string;
  description?: string;
  updatedAt: string;
}

export type QueueKind = "obligation" | "observation" | "discussion" | "task" | "review" | "vote";

export interface QueueItem<T = unknown> {
  id: string;
  kind: QueueKind;
  status: "pending" | "handled" | "skipped" | "expired";
  payload: T;
  assignedAt?: string;
  deadline?: string;
  updatedAt: string;
}

/** Result returned by daemon handlers */
export interface HandlerResult {
  handled: boolean;
  action?: string;
  reason?: string;
  artifacts?: Array<{ uri: string; hash?: string; mediaType?: string }>;
  error?: unknown;
}

/** v0.2 unified runtime input — replaces RuntimeExecutionInput */
export interface RuntimeInput {
  agentId: string;
  runtimeBindingId: string;
  assignmentId: string;
  assignmentKind: "observation" | "discussion" | "task" | "review" | "vote";
  organization?: OrganizationSnapshot;
  project?: unknown;
  handbook?: ProjectHandbookSnapshot;
  mechanism?: MechanismSnapshot;
  payload: unknown;
  contextBundle?: unknown;
  knowledgeSnapshot?: unknown;
  workingDirectory: string;
}

/** v0.2 unified runtime output */
export interface RuntimeOutput {
  status: "success" | "failed" | "partial";
  summary: string;
  artifact?: { uri: string; hash?: string; mediaType?: string };
  structuredResult?: unknown;
  contribution?: string;
  executionReceipt: ExecutionReceiptData;
  logs?: string;
}

/** Legacy input to RuntimeHost (kept for adapter compatibility) */
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
    deterministicE2E?: boolean;
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
