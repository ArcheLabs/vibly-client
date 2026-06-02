import { randomUUID } from "node:crypto";
import { unwrapEnvelope } from "@vibly-ai/coordinator-http-contract/client";
import { CoordinatorApiError as ContractApiError } from "@vibly-ai/coordinator-http-contract/errors";
import { createCliContractClient, type ContractCoordinatorClient } from "./contractClient.js";
import { path } from "./contractPaths.js";
import { CoordinatorApiError } from "./errors.js";
import { clientVersionHeaders } from "../version.js";
import type {
  ActionIntentInput,
  ActionIntentReceipt,
  AgentInbox,
  MechanismSnapshot,
  NetworkManifest,
  OrganizationSnapshot,
  ProjectHandbookSnapshot,
  VersionPolicy,
} from "../domain/clientTypes.js";
import type {
  Agent,
  ArtifactRef,
  ContextBundle,
  ContextReceipt,
  EventEnvelope,
  HealthResponse,
  KnowledgeVersion,
  NegotiationInstance,
  Objective,
  PageMeta,
  Principal,
  Project,
  RewardIntent,
  ReviewRecord,
  RuntimeBinding,
  StateView,
  Submission,
  WorkClaim,
  WorkOrder,
  AgentHeartbeat,
} from "./types.js";

type ContractResult = { response: Response; data?: unknown; error?: unknown };

export interface CoordinatorClientOptions {
  baseUrl: string;
  token: string;
  networkId?: string;
  /** Maximum retries for GET requests (default: 2) */
  maxRetries?: number;
  /** Base delay in ms for retry backoff (default: 500) */
  retryBaseMs?: number;
}

export class CoordinatorClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly networkId?: string;
  private readonly contract: ContractCoordinatorClient;

  constructor(opts: CoordinatorClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
    this.maxRetries = opts.maxRetries ?? 2;
    this.retryBaseMs = opts.retryBaseMs ?? 500;
    this.networkId = opts.networkId;
    this.contract = createCliContractClient({
      baseUrl: this.baseUrl,
      token: this.token,
      networkId: opts.networkId,
      maxRetries: this.maxRetries,
      retryBaseMs: this.retryBaseMs,
    });
  }

  // ── Health ──────────────────────────────────────────────────────────────────

  async health(): Promise<HealthResponse> {
    return runContract(async () => {
      const result = await this.contract.GET(path("/health"));
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapEnvelope<HealthResponse>(result.data);
    });
  }

  async getVersionPolicy(): Promise<VersionPolicy> {
    return runContract(async () => {
      const result = await (this.contract.GET as never as (path: string) => Promise<ContractResult>)("/version-policy");
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<VersionPolicy>(unwrapEnvelope(result.data), "policy");
    });
  }

  async listNetworks(): Promise<NetworkManifest[]> {
    return runContract(async () => {
      const result = await (this.contract.GET as never as (path: string) => Promise<ContractResult>)("/networks");
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<NetworkManifest[]>(unwrapEnvelope(result.data), "networks");
    });
  }

  async getNetwork(networkId: string): Promise<NetworkManifest> {
    return runContract(async () => {
      const result = await (this.contract.GET as never as (path: string, options: { params: { path: { networkId: string } } }) => Promise<ContractResult>)("/networks/{networkId}", {
        params: { path: { networkId } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<NetworkManifest>(unwrapEnvelope(result.data), "network");
    });
  }


  // ── Principals ──────────────────────────────────────────────────────────────

  async registerPrincipal(input: {
    kind: string;
    displayName?: string;
    description?: string;
    identityBindings?: unknown[];
    addressBindings?: unknown[];
  }): Promise<Principal> {
    return runContract(async () => {
      const result = await this.contract.POST("/principals", {
        body: input as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<Principal>(unwrapEnvelope(result.data), "principal");
    });
  }

  async listPrincipals(query?: { limit?: number; cursor?: string }): Promise<{ items: Principal[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/principals", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<Principal>(result.data, "items");
    });
  }

  async getPrincipal(id: string): Promise<Principal> {
    return runContract(async () => {
      const result = await this.contract.GET("/principals/{principalId}", {
        params: { path: { principalId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<Principal>(unwrapEnvelope(result.data), "principal");
    });
  }

  async bindPrincipalAddress(
    principalId: string,
    input: { chain: string; address: string; publicKey?: string; proof?: string; status?: string },
  ): Promise<Principal> {
    return runContract(async () => {
      const result = await this.contract.POST("/principals/{principalId}/identities", {
        params: { path: { principalId } },
        body: input as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<Principal>(unwrapEnvelope(result.data), "principal");
    });
  }

  // ── Agents ──────────────────────────────────────────────────────────────────

  async registerAgent(input: {
    principalId: string;
    displayName?: string;
    description?: string;
    capabilities?: string[];
    eligibleRoles?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<Agent> {
    return runContract(async () => {
      const result = await this.contract.POST("/agents", {
        body: input as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<Agent>(unwrapEnvelope(result.data), "agent");
    });
  }

  async listAgents(query?: { status?: string; limit?: number; cursor?: string }): Promise<{ items: Agent[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/agents", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<Agent>(result.data, "items");
    });
  }

  async getAgent(id: string): Promise<Agent> {
    return runContract(async () => {
      const result = await this.contract.GET("/agents/{agentId}", {
        params: { path: { agentId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<Agent>(unwrapEnvelope(result.data), "agent");
    });
  }

  async getAgentProfile(principalId: string): Promise<Record<string, unknown>> {
    return runContract(async () => {
      const result = await fetch(
        `${this.baseUrl}/agent-profiles/${encodeURIComponent(principalId)}`,
        { headers: this.requestHeaders() },
      );
      if (!result.ok) {
        const text = await result.text().catch(() => "");
        throw new CoordinatorApiError(result.status, text || "Agent profile request failed");
      }
      const json = (await result.json()) as unknown;
      return unwrapKey<Record<string, unknown>>(unwrapEnvelope(json), "agent");
    });
  }

  async changeAgentStatus(agentId: string, input: { nextStatus: string; reason?: string }): Promise<Agent> {
    return runContract(async () => {
      const result = await this.contract.POST("/agents/{agentId}/status", {
        params: { path: { agentId } },
        body: input as never,
    });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<Agent>(unwrapEnvelope(result.data), "agent");
    });
  }

  async createRuntimeBinding(
    agentId: string,
    input: {
      runtimeKind: string;
      runtimeAdapterId?: string;
      capabilities?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<RuntimeBinding> {
    return runContract(async () => {
      const result = await this.contract.POST("/agents/{agentId}/runtime-bindings", {
        params: { path: { agentId } },
        body: input as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<RuntimeBinding>(unwrapEnvelope(result.data), "runtimeBinding");
    });
  }

  async listRuntimeBindings(agentId: string): Promise<{ items: RuntimeBinding[] }> {
    return runContract(async () => {
      const result = await this.contract.GET("/agents/{agentId}/runtime-bindings", {
        params: { path: { agentId } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      const list = toList<RuntimeBinding>(result.data, "items");
      return { items: list.items };
    });
  }

  // ── Agent enrollment ─────────────────────────────────────────────────────────

  async createAgentEnrollmentChallenge(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return runContract(async () => {
      const result = await this.contract.POST("/agent-enrollments/challenges", {
        body: body as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<Record<string, unknown>>(unwrapEnvelope(result.data), "challenge");
    });
  }

  async authorizeAgentEnrollment(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return runContract(async () => {
      const result = await this.contract.POST("/agent-enrollments/authorizations", {
        body: body as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<Record<string, unknown>>(unwrapEnvelope(result.data), "authorization");
    });
  }

  // ── Projects ─────────────────────────────────────────────────────────────────

  async createProject(input: {
    slug: string;
    name: string;
    description?: string;
    sponsorPrincipalId: string;
    metadata?: Record<string, unknown>;
  }): Promise<Project> {
    return runContract(async () => {
      const result = await this.contract.POST("/projects", {
        body: input as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<Project>(unwrapEnvelope(result.data), "project");
    });
  }

  async listProjects(query?: { status?: string; limit?: number; cursor?: string }): Promise<{ items: Project[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/projects", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<Project>(result.data, "items");
    });
  }

  async getProject(id: string): Promise<Project> {
    return runContract(async () => {
      const result = await this.contract.GET("/projects/{projectId}", {
        params: { path: { projectId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<Project>(unwrapEnvelope(result.data), "project");
    });
  }

  async listObjectives(projectId: string): Promise<{ items: Objective[] }> {
    return runContract(async () => {
      const result = await this.contract.GET("/projects/{projectId}/objectives", {
        params: { path: { projectId } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      const list = toList<Objective>(result.data, "items");
      return { items: list.items };
    });
  }

  async getBoundary(projectId: string): Promise<unknown | null> {
    try {
      return await runContract(async () => {
        const result = await this.contract.GET("/projects/{projectId}/boundary", {
          params: { path: { projectId } },
        });
        if (!result.response.ok) throw fromContract(result.error, result.response);
        return unwrapKey<unknown>(unwrapEnvelope(result.data), "boundary") ?? null;
      });
    } catch (e) {
      if (e instanceof CoordinatorApiError && e.isNotFound()) return null;
      throw e;
    }
  }

  // ── Context ──────────────────────────────────────────────────────────────────

  async createContextBundle(input: {
    goalId?: string;
    actorId: string;
    artifacts?: ArtifactRef[];
  }): Promise<ContextBundle> {
    return runContract(async () => {
      const result = await this.contract.POST("/context/bundles", {
        body: input as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<ContextBundle>(unwrapEnvelope(result.data), "bundle");
    });
  }

  async getContextBundle(id: string): Promise<ContextBundle> {
    return runContract(async () => {
      const result = await this.contract.GET("/context/bundles/{bundleId}", {
        params: { path: { bundleId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<ContextBundle>(unwrapEnvelope(result.data), "bundle");
    });
  }

  async acceptContextBundle(input: {
    contextBundleId: string;
    actorId: string;
  }): Promise<ContextReceipt> {
    return runContract(async () => {
      const result = await this.contract.POST("/context/receipts", {
        body: input as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<ContextReceipt>(unwrapEnvelope(result.data), "receipt");
    });
  }

  // ── State ────────────────────────────────────────────────────────────────────

  async getLatestState(projectId: string): Promise<StateView | null> {
    try {
      return await runContract(async () => {
        const result = await this.contract.GET("/projects/{projectId}/state/latest", {
          params: { path: { projectId } },
        });
        if (!result.response.ok) throw fromContract(result.error, result.response);
        return unwrapKey<StateView>(unwrapEnvelope(result.data), "stateView") ?? null;
      });
    } catch (e) {
      if (e instanceof CoordinatorApiError && e.isNotFound()) return null;
      throw e;
    }
  }

  // ── Knowledge ────────────────────────────────────────────────────────────────

  async getLatestKnowledge(): Promise<KnowledgeVersion | null> {
    try {
      return await runContract(async () => {
        const result = await this.contract.GET("/knowledge/latest");
        if (!result.response.ok) throw fromContract(result.error, result.response);
        return unwrapKey<KnowledgeVersion>(unwrapEnvelope(result.data), "version") ?? null;
      });
    } catch (e) {
      if (e instanceof CoordinatorApiError && e.isNotFound()) return null;
      throw e;
    }
  }

  async getKnowledgeVersion(id: string): Promise<KnowledgeVersion> {
    return runContract(async () => {
      const result = await this.contract.GET("/knowledge/versions/{versionId}", {
        params: { path: { versionId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<KnowledgeVersion>(unwrapEnvelope(result.data), "version");
    });
  }

  async listKnowledgeVersions(query?: { limit?: number; cursor?: string }): Promise<{ items: KnowledgeVersion[] }> {
    return runContract(async () => {
      const result = await this.contract.GET("/knowledge/versions", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      const list = toList<KnowledgeVersion>(result.data, "items");
      return { items: list.items };
    });
  }

  // ── Work Orders ──────────────────────────────────────────────────────────────

  async listOpenWorkOrders(query?: { projectId?: string; limit?: number; cursor?: string }): Promise<{ items: WorkOrder[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/work-orders/open", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<WorkOrder>(result.data, "items");
    });
  }

  async listWorkOrders(query?: { projectId?: string; status?: string; limit?: number; cursor?: string }): Promise<{ items: WorkOrder[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/work-orders", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<WorkOrder>(result.data, "items");
    });
  }

  async getWorkOrder(id: string): Promise<WorkOrder> {
    return runContract(async () => {
      const result = await this.contract.GET("/work-orders/{workOrderId}", {
        params: { path: { workOrderId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<WorkOrder>(unwrapEnvelope(result.data), "workOrder");
    });
  }

  // ── Negotiations ─────────────────────────────────────────────────────────────

  async listNegotiations(query?: { status?: string; projectId?: string; limit?: number; cursor?: string }): Promise<{ items: NegotiationInstance[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/negotiations", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<NegotiationInstance>(result.data, "items");
    });
  }

  async getNegotiation(id: string): Promise<NegotiationInstance> {
    return runContract(async () => {
      const result = await this.contract.GET("/negotiations/{negotiationId}", {
        params: { path: { negotiationId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<NegotiationInstance>(unwrapEnvelope(result.data), "negotiation");
    });
  }

  // ── Reviews (read-only) ──────────────────────────────────────────────────────

  async listReviews(query?: { targetKind?: string; reviewerId?: string; result?: string; limit?: number }): Promise<{ items: ReviewRecord[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/reviews", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<ReviewRecord>(result.data, "items");
    });
  }

  // ── Rewards (read-only) ──────────────────────────────────────────────────────

  async listRewards(query?: { actorId?: string; status?: string; limit?: number; cursor?: string }): Promise<{ items: RewardIntent[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/rewards", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<RewardIntent>(result.data, "items");
    });
  }

  async getReward(id: string): Promise<RewardIntent> {
    return runContract(async () => {
      const result = await this.contract.GET("/rewards/{rewardIntentId}", {
        params: { path: { rewardIntentId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<RewardIntent>(unwrapEnvelope(result.data), "reward");
    });
  }

  // ── Governance (read + reconcile) ─────────────────────────────────────────────

  async listGovernanceMerged(query?: {
    projectId?: string;
    backend?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/governance/merged", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<unknown>(result.data, "items");
    });
  }

  async reconcileGovernanceSubject(
    governanceIntentId: string,
    input: { subjectId?: string; externalId?: string; metadata?: Record<string, unknown> },
  ): Promise<unknown> {
    return runContract(async () => {
      const result = await this.contract.POST("/governance/intents/{governanceIntentId}/reconcile-subject", {
        params: { path: { governanceIntentId } },
        body: input as never,
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapEnvelope<unknown>(result.data);
    });
  }

  async submitGovernanceOpenGov(governanceIntentId: string, input: Record<string, unknown>): Promise<unknown> {
    return runContract(async () => {
      const result = await this.contract.POST("/governance/intents/{governanceIntentId}/submit-opengov", {
        params: { path: { governanceIntentId } },
        body: input as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapEnvelope<unknown>(result.data);
    });
  }

  async submitGovernanceVoteOpenGov(subjectId: string, input: Record<string, unknown>): Promise<unknown> {
    return runContract(async () => {
      const result = await this.contract.POST("/governance/subjects/{subjectId}/vote-opengov", {
        params: { path: { subjectId } },
        body: input as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapEnvelope<unknown>(result.data);
    });
  }

  async listGovernanceSubjects(query?: {
    backend?: string;
    chainId?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/governance/subjects", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<unknown>(result.data, "items");
    });
  }

  async getGovernanceCheckpoint(query?: {
    backend?: string;
    chainId?: string;
  }): Promise<{ checkpoint: unknown | null; items?: unknown[] }> {
    return runContract(async () => {
      const result = await this.contract.GET("/governance/checkpoint", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      const payload = unwrapEnvelope<{ checkpoint?: unknown | null; items?: unknown[] }>(result.data);
      return {
        checkpoint: payload?.checkpoint ?? null,
        items: Array.isArray(payload?.items) ? payload.items : undefined,
      };
    });
  }

  async listGovernanceBackends(): Promise<{ items: unknown[] }> {
    return runContract(async () => {
      const result = await this.contract.GET("/governance/backends");
      if (!result.response.ok) throw fromContract(result.error, result.response);
      const payload = unwrapEnvelope<Record<string, unknown>>(result.data);
      const items = extractArray(payload, "backends");
      return { items };
    });
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  async listEvents(query?: {
    type?: string;
    correlationId?: string;
    from?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: EventEnvelope[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/events", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<EventEnvelope>(result.data, "items");
    });
  }

  async getEvent(id: string): Promise<EventEnvelope> {
    return runContract(async () => {
      const result = await this.contract.GET("/events/{eventId}", {
        params: { path: { eventId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<EventEnvelope>(unwrapEnvelope(result.data), "event");
    });
  }

  // ── Traces ───────────────────────────────────────────────────────────────────

  async listTraces(query?: { limit?: number; cursor?: string }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/traces", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<unknown>(result.data, "items");
    });
  }

  async getTrace(id: string): Promise<unknown> {
    return runContract(async () => {
      const result = await this.contract.GET("/traces/{traceId}", {
        params: { path: { traceId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<unknown>(unwrapEnvelope(result.data), "trace");
    });
  }

  async verifyTrace(id: string): Promise<unknown> {
    return runContract(async () => {
      const result = await this.contract.POST("/traces/{traceId}/verify", {
        params: { path: { traceId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapEnvelope<unknown>(result.data);
    });
  }

  async replayTrace(id: string): Promise<unknown> {
    return runContract(async () => {
      const result = await this.contract.POST("/traces/{traceId}/replay", {
        params: { path: { traceId: id } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapEnvelope<unknown>(result.data);
    });
  }

  // ── Phase F ──────────────────────────────────────────────────────────────────

  async runAgentCollaborationScenario(): Promise<unknown> {
    return runContract(async () => {
      const result = await (this.contract.POST as never as (path: string, init: unknown) => Promise<ContractResult>)("/dev/scenarios/agent-collaboration/runs", {
        body: {} as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<unknown>(unwrapEnvelope(result.data), "run");
    });
  }

  async listAgentCollaborationScenarioRuns(query?: { limit?: number; cursor?: string }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await (this.contract.GET as never as (path: string, init: unknown) => Promise<ContractResult>)("/dev/scenarios/agent-collaboration/runs", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<unknown>(result.data, "items");
    });
  }

  // ── Phase H ──────────────────────────────────────────────────────────────────

  async runIncentiveRiskScenario(): Promise<unknown> {
    return runContract(async () => {
      const result = await (this.contract.POST as never as (path: string, init: unknown) => Promise<ContractResult>)("/dev/scenarios/incentive-risk/runs", {
        body: {} as never,
        headers: idempotencyHeaders(),
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<unknown>(unwrapEnvelope(result.data), "run");
    });
  }

  async listIncentiveRiskScenarioRuns(query?: { projectId?: string; limit?: number; cursor?: string }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await (this.contract.GET as never as (path: string, init: unknown) => Promise<ContractResult>)("/dev/scenarios/incentive-risk/runs", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<unknown>(result.data, "items");
    });
  }

  async getProjectOverview(projectId: string): Promise<unknown> {
    return runContract(async () => {
      const result = await this.contract.GET("/projects/{projectId}/overview", {
        params: { path: { projectId } },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<unknown>(unwrapEnvelope(result.data), "overview");
    });
  }

  async listGuardianRequests(query?: { projectId?: string; actionId?: string; status?: string; limit?: number; cursor?: string }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return runContract(async () => {
      const result = await this.contract.GET("/guardian-requests", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return toList<unknown>(result.data, "items");
    });
  }

  // ── ActionIntent (unified write path) ────────────────────────────────────────

  async submitActionIntent(intent: ActionIntentInput): Promise<ActionIntentReceipt> {
    return runContract(async () => {
      const result = await fetch(`${this.baseUrl}/action-intents`, {
        method: "POST",
        headers: this.requestHeaders({
          "Content-Type": "application/json",
          "Idempotency-Key": intent.idempotencyKey ?? randomUUID(),
        }),
        body: JSON.stringify(intent),
      });
      if (!result.ok) {
        const text = await result.text().catch(() => "");
        throw new CoordinatorApiError(result.status, text || "ActionIntent submission failed");
      }
      const json = (await result.json()) as unknown;
      const data = unwrapEnvelope<ActionIntentReceipt>(json);
      return data as ActionIntentReceipt;
    });
  }

  async getAgentInbox(principalId: string, query?: { organizationId?: string; projectId?: string; limit?: number }): Promise<AgentInbox> {
    return runContract(async () => {
      const result = await fetch(
        `${this.baseUrl}/agents/${encodeURIComponent(principalId)}/inbox?${new URLSearchParams(queryFromInput(query))}`,
        { headers: this.requestHeaders() },
      );
      if (!result.ok) {
        const text = await result.text().catch(() => "");
        throw new CoordinatorApiError(result.status, text || "Agent inbox request failed");
      }
      const json = (await result.json()) as unknown;
      const data = unwrapEnvelope<{ inbox: AgentInbox }>(json);
      return data.inbox;
    });
  }

  // ── Organizations (v0.2) ─────────────────────────────────────────────────────

  async listOrganizations(query?: { limit?: number; cursor?: string }): Promise<{ items: OrganizationSnapshot[] }> {
    try {
      const result = await fetch(
        `${this.baseUrl}/organizations?${new URLSearchParams(queryFromInput(query))}`,
        { headers: this.requestHeaders() },
      );
      if (!result.ok) return { items: [] };
      const json = (await result.json()) as unknown;
      const items = extractArray(unwrapEnvelope(json)) as OrganizationSnapshot[];
      return { items };
    } catch {
      return { items: [] };
    }
  }

  async getOrganization(id: string): Promise<OrganizationSnapshot | null> {
    try {
      const result = await fetch(`${this.baseUrl}/organizations/${encodeURIComponent(id)}`, {
        headers: this.requestHeaders(),
      });
      if (!result.ok) return null;
      const json = (await result.json()) as unknown;
      return unwrapKey<OrganizationSnapshot>(unwrapEnvelope(json), "organization");
    } catch {
      return null;
    }
  }

  // ── Handbooks (v0.2) ─────────────────────────────────────────────────────────

  async getProjectHandbook(projectId: string): Promise<ProjectHandbookSnapshot | null> {
    try {
      const result = await fetch(
        `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/handbook`,
        { headers: this.requestHeaders() },
      );
      if (!result.ok) return null;
      const json = (await result.json()) as unknown;
      const raw = unwrapKey<unknown>(unwrapEnvelope(json), "handbook");
      if (!raw) return null;
      return { projectId, content: raw, updatedAt: new Date().toISOString() };
    } catch {
      return null;
    }
  }

  // ── Mechanisms (v0.2) ────────────────────────────────────────────────────────

  async listMechanisms(query?: { organizationId?: string; projectId?: string; limit?: number }): Promise<{ items: MechanismSnapshot[] }> {
    try {
      const result = await fetch(
        `${this.baseUrl}/mechanisms?${new URLSearchParams(queryFromInput(query))}`,
        { headers: this.requestHeaders() },
      );
      if (!result.ok) return { items: [] };
      const json = (await result.json()) as unknown;
      const items = extractArray(unwrapEnvelope(json)) as MechanismSnapshot[];
      return { items };
    } catch {
      return { items: [] };
    }
  }

  // ── Queue Snapshots (v0.2) ───────────────────────────────────────────────────

  async listObligations(query?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }> {
    return this._listQueue(`/obligations`, query);
  }

  async listAgentStakes(query?: { principalId?: string; chainId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }> {
    return this._listQueue(`/agent-stakes`, query);
  }

  async listObservationAssignments(query?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }> {
    return this._listQueue(`/assignments`, { ...query, kind: "observation" });
  }

  async listDiscussionParticipations(query?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }> {
    return this._listQueue(`/assignments`, { ...query, kind: "discussion" });
  }

  async listAvailableTasks(query?: { projectId?: string; limit?: number }): Promise<{ items: unknown[] }> {
    return this._listQueue(`/work-orders/open`, query);
  }

  async getTask(taskId: string): Promise<unknown> {
    return runContract(async () => {
      const result = await fetch(`${this.baseUrl}/tasks/${encodeURIComponent(taskId)}`, {
        headers: this.requestHeaders(),
      });
      if (!result.ok) throw new CoordinatorApiError(result.status, `Failed to fetch task ${taskId}`);
      const json = (await result.json()) as unknown;
      const envelope = unwrapEnvelope(json);
      // Coordinator wraps task under { task: {...} } or returns it directly
      if (envelope && typeof envelope === "object" && "task" in (envelope as Record<string, unknown>)) {
        return (envelope as Record<string, unknown>)["task"];
      }
      return envelope;
    });
  }

  async listAssignedTasks(query?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }> {
    return this._listQueue(`/work-orders`, { ...query, status: query?.status ?? "claimed" });
  }

  async listReviewAssignments(query?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }> {
    return runContract(async () => {
      const result = await this.contract.GET("/reviews", {
        params: { query: queryFromInput(query) as never },
      });
      if (!result.response.ok) return { items: [] };
      return toList<unknown>(result.data, "items");
    });
  }

  async listVotingAssignments(query?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }> {
    return this._listQueue(`/negotiations`, { ...query, status: "open" });
  }

  private async _listQueue(endpoint: string, query?: Record<string, string | number | boolean | undefined>): Promise<{ items: unknown[] }> {
    try {
      const result = await fetch(
        `${this.baseUrl}${endpoint}?${new URLSearchParams(queryFromInput(query))}`,
        { headers: this.requestHeaders() },
      );
      if (!result.ok) return { items: [] };
      const json = (await result.json()) as unknown;
      const items = extractArray(unwrapEnvelope(json)) as unknown[];
      return { items };
    } catch {
      return { items: [] };
    }
  }

  async getJoinEligibility(organizationId: string, principalId: string): Promise<unknown> {
    return runContract(async () => {
      const result = await (this.contract.GET as never as (path: string, init: unknown) => Promise<ContractResult>)(
        "/organizations/{organizationId}/agents/{principalId}/join-eligibility",
        { params: { path: { organizationId, principalId } } },
      );
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<unknown>(unwrapEnvelope(result.data), "eligibility");
    });
  }

  async sendAgentHeartbeat(agentId: string, body: {
    clientVersion?: string;
    daemonVersion?: string;
    contractVersion?: string;
    protocolVersion?: string;
    availability?: string;
    upgradePhase?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgentHeartbeat> {
    return runContract(async () => {
      const result = await (this.contract.POST as never as (path: string, init: unknown) => Promise<ContractResult>)(
        "/agents/{id}/heartbeat",
        { params: { path: { id: agentId } }, body: body as never, headers: idempotencyHeaders() },
      );
      if (!result.response.ok) throw fromContract(result.error, result.response);
      return unwrapKey<AgentHeartbeat>(unwrapEnvelope(result.data), "heartbeat");
    });
  }

  private requestHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      ...clientVersionHeaders(),
      ...(this.networkId ? { "X-Vibly-Network-Id": this.networkId } : {}),
      ...(extra ?? {}),
    };
  }

  /** Base URL for SSE stream */
  getStreamUrl(projectId?: string): string {
    if (projectId) {
      return `${this.baseUrl}${path("/projects/{projectId}/stream").replace("{projectId}", encodeURIComponent(projectId))}`;
    }
    return `${this.baseUrl}${path("/streams/events")}`;
  }

  getAuthToken(): string {
    return this.token;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

function idempotencyHeaders(): Record<string, string> {
  return { "Idempotency-Key": randomUUID() };
}

function queryFromInput(input?: Record<string, string | number | boolean | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === "") continue;
    out[key] = String(value);
  }
  return out;
}

function unwrapKey<T>(value: unknown, key: string): T {
  if (value && typeof value === "object" && key in value) return (value as Record<string, T>)[key];
  return value as T;
}

function extractArray(value: unknown, preferredKey?: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (preferredKey && Array.isArray(record[preferredKey])) return record[preferredKey] as unknown[];
  for (const item of Object.values(record)) {
    if (Array.isArray(item)) return item;
  }
  return [];
}

function toList<T>(payload: unknown, preferredKey?: string): { items: T[]; meta?: PageMeta } {
  const data = unwrapEnvelope<unknown>(payload);
  const items = extractArray(data, preferredKey) as T[];
  const env = payload as { page?: Partial<PageMeta>; meta?: Partial<PageMeta> };
  const rawMeta = env.page ?? env.meta;
  if (!rawMeta || typeof rawMeta !== "object") return { items };
  return {
    items,
    meta: {
      limit: Number(rawMeta.limit ?? items.length),
      nextCursor: (rawMeta.nextCursor as string | null | undefined) ?? null,
      total: rawMeta.total !== undefined ? Number(rawMeta.total) : undefined,
    },
  };
}

function fromContract(error: unknown, response: Response | undefined): CoordinatorApiError {
  if (error instanceof ContractApiError) {
    return new CoordinatorApiError(error.status, error.message, error.code);
  }
  const status = response?.status ?? 0;
  const failure = error && typeof error === "object" ? (error as { error?: { code?: string; message?: string } }) : {};
  return new CoordinatorApiError(
    status,
    failure.error?.message ?? "Coordinator request failed",
    failure.error?.code ?? (status > 0 ? `HTTP_${status}` : undefined),
  );
}

async function runContract<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ContractApiError) throw fromContract(err, undefined);
    throw err;
  }
}
