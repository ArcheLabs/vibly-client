/** Mirrors coordinator HTTP response shapes. No @concord/* dependency. */

export interface HealthResponse {
  status: string;
  version?: string;
  uptime?: number;
}

export interface Principal {
  id: string;
  kind: "human" | "agent" | "service" | "guardian" | "organization";
  displayName?: string;
  description?: string;
  status: string;
  identityBindings?: AddressBinding[];
  createdAt?: string;
}

export interface AddressBinding {
  id?: string;
  chain: string;
  address: string;
  publicKey?: string;
  status?: string;
}

export interface Agent {
  id: string;
  principalId: string;
  displayName?: string;
  description?: string;
  status: string;
  capabilities?: string[];
  eligibleRoles?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface RuntimeBinding {
  id: string;
  agentId: string;
  runtimeKind: string;
  runtimeAdapterId?: string;
  status?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  description?: string;
  sponsorPrincipalId?: string;
  status: string;
  protocol?: {
    version?: unknown;
    traceRequired?: boolean;
    observationCycleInterval?: number;
  };
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface Objective {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  kind?: string;
  status: string;
  isPrimary?: boolean;
  createdAt?: string;
}

export interface Boundary {
  id: string;
  projectId: string;
  status: string;
  rules?: BoundaryRule[];
  createdAt?: string;
}

export interface BoundaryRule {
  id: string;
  actionType: string;
  effect: "allow" | "deny";
  reason?: string;
  condition?: unknown;
}

export interface WorkOrder {
  id: string;
  actionId?: string;
  goalId?: string;
  projectId?: string;
  objectiveId?: string;
  title: string;
  description: string;
  status: string;
  contextBundleId?: string;
  requiredCapabilities?: unknown[];
  reward?: unknown;
  riskLevel?: string;
  requiredRuntimeKind?: string[];
  createdAt?: string;
  expiresAt?: string;
}

export interface WorkClaim {
  id?: string;
  workOrderId: string;
  actorId?: string;
  agentId?: string;
  claimedAt?: string;
  leaseExpiresAt?: string;
}

export interface Submission {
  id: string;
  workOrderId: string;
  submittedBy?: string;
  agentId?: string;
  artifacts?: ArtifactRef[];
  summary: string;
  contextReceipt?: unknown;
  executionReceipt?: unknown;
  submittedAt?: string;
}

export interface ArtifactRef {
  uri: string;
  hash?: string;
  mediaType?: string;
}

export interface ContextBundle {
  id: string;
  goalId?: string;
  projectId?: string;
  objectiveId?: string;
  stateViewId?: string;
  stateViewVersion?: string;
  knowledgeVersionId?: string;
  knowledgeHash?: string;
  protocolVersion?: string;
  artifacts?: ArtifactRef[];
  createdAt?: string;
  expiresAt?: string;
}

export interface ContextReceipt {
  contextBundleId: string;
  projectId?: string;
  stateViewId?: string;
  stateViewVersion?: string;
  knowledgeVersionId?: string;
  knowledgeHash?: string;
  agentId?: string;
  runtimeBindingId?: string;
  actorId?: string;
  acceptedAt?: string;
}

export interface KnowledgeVersion {
  id: string;
  parentId?: string;
  hash?: string;
  createdAt?: string;
  createdBy?: string;
  commitIds?: string[];
}

export interface StateView {
  id: string;
  version?: string;
  knowledgeVersionId?: string;
  projectionHash?: string;
  createdAt?: string;
}

export interface NegotiationInstance {
  id: string;
  protocolId?: string;
  actionId?: string;
  topic?: string;
  initiator?: string;
  participants?: string[];
  status: string;
  rounds?: unknown[];
  createdAt?: string;
  closedAt?: string;
}

export interface ReviewRecord {
  id: string;
  target?: { kind: string; submissionId?: string; candidateId?: string; actionId?: string };
  reviewerId?: string;
  result: string;
  score?: number;
  rationale?: string;
  createdAt?: string;
}

export interface RewardIntent {
  id: string;
  kind?: string;
  actorId?: string;
  workOrderId?: string;
  submissionId?: string;
  amount?: { amount: string; token: string };
  reason?: string;
  status: string;
  createdAt?: string;
}

export interface EventEnvelope {
  id: string;
  type: string;
  version?: string;
  timestamp?: string;
  actorId?: string;
  correlationId?: string;
  payload?: unknown;
  hash?: string;
}

export interface PageMeta {
  limit: number;
  nextCursor?: string | null;
  total?: number;
}

export interface ListResponse<T> {
  items: T[];
  meta?: PageMeta;
}

/** Standard API response wrapper from coordinator */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  meta?: PageMeta;
}

export interface AgentHeartbeat {
  agentId: string;
  lastSeenAt: string;
  clientVersion?: string;
  daemonVersion?: string;
  contractVersion?: string;
  protocolVersion?: string;
  availability?: string;
  upgradePhase?: string;
  metadata?: Record<string, unknown>;
}
