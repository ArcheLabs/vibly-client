import { randomUUID } from "node:crypto";
import { CoordinatorApiError } from "./errors.js";
import { buildQueryString } from "./pagination.js";
import { ROUTES } from "./routes.js";
import type {
  Agent,
  ApiResponse,
  ArtifactRef,
  ContextBundle,
  ContextReceipt,
  EventEnvelope,
  HealthResponse,
  KnowledgeVersion,
  ListResponse,
  NegotiationInstance,
  PageMeta,
  Principal,
  Project,
  Objective,
  RewardIntent,
  ReviewRecord,
  RuntimeBinding,
  StateView,
  Submission,
  WorkClaim,
  WorkOrder,
} from "./types.js";

export interface CoordinatorClientOptions {
  baseUrl: string;
  token: string;
  /** Maximum retries for GET requests (default: 2) */
  maxRetries?: number;
  /** Base delay in ms for retry backoff (default: 500) */
  retryBaseMs?: number;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  retry?: boolean;
}

export class CoordinatorClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  constructor(opts: CoordinatorClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
    this.maxRetries = opts.maxRetries ?? 2;
    this.retryBaseMs = opts.retryBaseMs ?? 500;
  }

  // ── Core request method ─────────────────────────────────────────────────────

  private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, idempotencyKey, retry } = opts;
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    const shouldRetry = retry ?? method === "GET";
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= (shouldRetry ? this.maxRetries : 0); attempt++) {
      if (attempt > 0) {
        await sleep(this.retryBaseMs * 2 ** (attempt - 1));
      }
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (!res.ok) {
          let apiCode: string | undefined;
          let apiMessage = `HTTP ${res.status}`;
          try {
            const j = (await res.json()) as ApiResponse;
            apiMessage = j.error?.message ?? apiMessage;
            apiCode = j.error?.code;
          } catch { /* ignore parse errors */ }
          throw new CoordinatorApiError(res.status, apiMessage, apiCode);
        }

        const json = (await res.json()) as ApiResponse<T>;
        if (!json.ok) {
          throw new CoordinatorApiError(
            res.status,
            json.error?.message ?? "API returned ok=false",
            json.error?.code,
          );
        }
        return json.data as T;
      } catch (e) {
        if (e instanceof CoordinatorApiError) {
          // Don't retry 4xx errors
          if (e.status >= 400 && e.status < 500) throw e;
        }
        lastError = e instanceof Error ? e : new Error(String(e));
        if (!shouldRetry) throw lastError;
      }
    }
    throw lastError!;
  }

  private async list<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<{ items: T[]; meta?: PageMeta }> {
    const qs = query ? buildQueryString(query) : "";
    const url = `${path}${qs}`;
    const res = await fetch(`${this.baseUrl}${url}`, {
      headers: { "Authorization": `Bearer ${this.token}` },
    });
    if (!res.ok) {
      const apiCode = undefined;
      throw new CoordinatorApiError(res.status, `HTTP ${res.status}`, apiCode);
    }
    const json = (await res.json()) as ApiResponse & { items?: T[]; data?: T[] | { items?: T[] }; meta?: PageMeta };
    const raw = json.data;
    if (Array.isArray(raw)) return { items: raw, meta: json.meta };
    if (raw && typeof raw === "object" && "items" in raw) {
      return { items: (raw as { items: T[] }).items ?? [], meta: json.meta };
    }
    return { items: (raw as T[]) ?? [], meta: json.meta };
  }

  // ── Health ──────────────────────────────────────────────────────────────────

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>(ROUTES.health);
  }

  // ── Principals ──────────────────────────────────────────────────────────────

  async registerPrincipal(input: {
    kind: string;
    displayName?: string;
    description?: string;
    identityBindings?: unknown[];
    addressBindings?: unknown[];
  }): Promise<Principal> {
    const data = await this.request<{ principal: Principal }>(ROUTES.principals, {
      method: "POST",
      body: input,
      idempotencyKey: randomUUID(),
    });
    return data.principal;
  }

  async listPrincipals(query?: { limit?: number; cursor?: string }): Promise<{ items: Principal[]; meta?: PageMeta }> {
    return this.list<Principal>(ROUTES.principals, query);
  }

  async getPrincipal(id: string): Promise<Principal> {
    const data = await this.request<{ principal: Principal }>(ROUTES.principal(id));
    return data.principal;
  }

  async bindPrincipalAddress(
    principalId: string,
    input: { chain: string; address: string; publicKey?: string; proof?: string; status?: string },
  ): Promise<Principal> {
    const data = await this.request<{ principal: Principal }>(
      ROUTES.principalIdentities(principalId),
      { method: "POST", body: input, idempotencyKey: randomUUID() },
    );
    return data.principal;
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
    const data = await this.request<{ agent: Agent }>(ROUTES.agents, {
      method: "POST",
      body: input,
      idempotencyKey: randomUUID(),
    });
    return data.agent;
  }

  async listAgents(query?: { status?: string; limit?: number; cursor?: string }): Promise<{ items: Agent[]; meta?: PageMeta }> {
    return this.list<Agent>(ROUTES.agents, query);
  }

  async getAgent(id: string): Promise<Agent> {
    const data = await this.request<{ agent: Agent }>(ROUTES.agent(id));
    return data.agent;
  }

  async changeAgentStatus(agentId: string, input: { nextStatus: string; reason?: string }): Promise<Agent> {
    const data = await this.request<{ agent: Agent }>(ROUTES.agentStatus(agentId), {
      method: "POST",
      body: input,
    });
    return data.agent;
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
    const data = await this.request<{ runtimeBinding: RuntimeBinding }>(
      ROUTES.agentRuntimeBindings(agentId),
      { method: "POST", body: input, idempotencyKey: randomUUID() },
    );
    return data.runtimeBinding;
  }

  async listRuntimeBindings(agentId: string): Promise<{ items: RuntimeBinding[] }> {
    return this.list<RuntimeBinding>(ROUTES.agentRuntimeBindings(agentId));
  }

  // ── Projects ─────────────────────────────────────────────────────────────────

  async createProject(input: {
    slug: string;
    name: string;
    description?: string;
    sponsorPrincipalId: string;
    metadata?: Record<string, unknown>;
  }): Promise<Project> {
    const data = await this.request<{ project: Project }>(ROUTES.projects, {
      method: "POST",
      body: input,
      idempotencyKey: randomUUID(),
    });
    return data.project;
  }

  async listProjects(query?: { status?: string; limit?: number; cursor?: string }): Promise<{ items: Project[]; meta?: PageMeta }> {
    return this.list<Project>(ROUTES.projects, query);
  }

  async getProject(id: string): Promise<Project> {
    const data = await this.request<{ project: Project }>(ROUTES.project(id));
    return data.project;
  }

  async listObjectives(projectId: string): Promise<{ items: Objective[] }> {
    return this.list<Objective>(ROUTES.projectObjectives(projectId));
  }

  async getBoundary(projectId: string): Promise<unknown | null> {
    try {
      const data = await this.request<{ boundary: unknown }>(ROUTES.projectBoundary(projectId));
      return (data as { boundary: unknown }).boundary ?? null;
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
    const data = await this.request<{ bundle: ContextBundle }>(ROUTES.contextBundles, {
      method: "POST",
      body: input,
      idempotencyKey: randomUUID(),
    });
    return data.bundle;
  }

  async getContextBundle(id: string): Promise<ContextBundle> {
    const data = await this.request<{ bundle: ContextBundle }>(ROUTES.contextBundle(id));
    return data.bundle;
  }

  async acceptContextBundle(input: {
    contextBundleId: string;
    actorId: string;
  }): Promise<ContextReceipt> {
    const data = await this.request<{ receipt: ContextReceipt }>(ROUTES.contextReceipts, {
      method: "POST",
      body: input,
      idempotencyKey: randomUUID(),
    });
    return data.receipt;
  }

  // ── State ────────────────────────────────────────────────────────────────────

  async getLatestState(projectId: string): Promise<StateView | null> {
    try {
      const data = await this.request<{ stateView: StateView }>(
        ROUTES.projectStateLatest(projectId),
      );
      return (data as { stateView: StateView }).stateView ?? null;
    } catch (e) {
      if (e instanceof CoordinatorApiError && e.isNotFound()) return null;
      throw e;
    }
  }

  // ── Knowledge ────────────────────────────────────────────────────────────────

  async getLatestKnowledge(): Promise<KnowledgeVersion | null> {
    try {
      const data = await this.request<{ version: KnowledgeVersion }>(ROUTES.knowledgeLatest);
      return (data as { version: KnowledgeVersion }).version ?? null;
    } catch (e) {
      if (e instanceof CoordinatorApiError && e.isNotFound()) return null;
      throw e;
    }
  }

  async getKnowledgeVersion(id: string): Promise<KnowledgeVersion> {
    const data = await this.request<{ version: KnowledgeVersion }>(ROUTES.knowledgeVersion(id));
    return (data as { version: KnowledgeVersion }).version;
  }

  async listKnowledgeVersions(query?: { limit?: number; cursor?: string }): Promise<{ items: KnowledgeVersion[] }> {
    return this.list<KnowledgeVersion>(ROUTES.knowledgeVersions, query);
  }

  // ── Work Orders ──────────────────────────────────────────────────────────────

  async listOpenWorkOrders(query?: { projectId?: string; limit?: number; cursor?: string }): Promise<{ items: WorkOrder[]; meta?: PageMeta }> {
    return this.list<WorkOrder>(ROUTES.workOrdersOpen, query);
  }

  async listWorkOrders(query?: { projectId?: string; status?: string; limit?: number; cursor?: string }): Promise<{ items: WorkOrder[]; meta?: PageMeta }> {
    return this.list<WorkOrder>(ROUTES.workOrders, query);
  }

  async getWorkOrder(id: string): Promise<WorkOrder> {
    const data = await this.request<{ workOrder: WorkOrder }>(ROUTES.workOrder(id));
    return (data as { workOrder: WorkOrder }).workOrder;
  }

  async claimWorkOrder(
    workOrderId: string,
    input: { actorId: string; leaseMs?: number },
  ): Promise<WorkClaim> {
    const data = await this.request<{ claim: WorkClaim }>(ROUTES.workOrderClaim(workOrderId), {
      method: "POST",
      body: input,
      idempotencyKey: randomUUID(),
    });
    return (data as { claim: WorkClaim }).claim;
  }

  async submitWorkOrder(
    workOrderId: string,
    input: {
      submittedBy: string;
      contextBundleId: string;
      executionReceipt?: unknown;
      artifacts?: ArtifactRef[];
      summary: string;
    },
  ): Promise<Submission> {
    const data = await this.request<{ submission: Submission }>(
      ROUTES.workOrderSubmit(workOrderId),
      {
        method: "POST",
        body: input,
        idempotencyKey: randomUUID(),
      },
    );
    return (data as { submission: Submission }).submission;
  }

  // ── Negotiations ─────────────────────────────────────────────────────────────

  async listNegotiations(query?: { status?: string; projectId?: string; limit?: number; cursor?: string }): Promise<{ items: NegotiationInstance[]; meta?: PageMeta }> {
    return this.list<NegotiationInstance>(ROUTES.negotiations, query);
  }

  async getNegotiation(id: string): Promise<NegotiationInstance> {
    const data = await this.request<{ negotiation: NegotiationInstance }>(ROUTES.negotiation(id));
    return (data as { negotiation: NegotiationInstance }).negotiation;
  }

  async submitNegotiationPosition(
    negotiationId: string,
    input: { actorId: string; stance: string; rationale: string; score?: number },
  ): Promise<NegotiationInstance> {
    const data = await this.request<{ negotiation: NegotiationInstance }>(
      ROUTES.negotiationPositions(negotiationId),
      {
        method: "POST",
        body: input,
        idempotencyKey: randomUUID(),
      },
    );
    return (data as { negotiation: NegotiationInstance }).negotiation;
  }

  async closeNegotiation(
    negotiationId: string,
    input?: { source?: string },
  ): Promise<unknown> {
    return this.request(ROUTES.negotiationClose(negotiationId), {
      method: "POST",
      body: input ?? {},
    });
  }

  // ── Reviews ──────────────────────────────────────────────────────────────────

  async requestReview(input: {
    target: { kind: string; submissionId?: string; candidateId?: string; actionId?: string };
    requestedBy: string;
  }): Promise<unknown> {
    return this.request(ROUTES.reviewRequests, {
      method: "POST",
      body: input,
      idempotencyKey: randomUUID(),
    });
  }

  async listReviews(query?: { targetKind?: string; reviewerId?: string; result?: string; limit?: number }): Promise<{ items: ReviewRecord[]; meta?: PageMeta }> {
    return this.list<ReviewRecord>(ROUTES.reviews, query);
  }

  async submitReview(input: {
    target: { kind: string; submissionId?: string; candidateId?: string; actionId?: string };
    reviewerId: string;
    result: string;
    score?: number;
    rationale: string;
    contextBundleId: string;
    evidence?: unknown[];
  }): Promise<ReviewRecord> {
    const data = await this.request<{ review: ReviewRecord }>(ROUTES.reviews, {
      method: "POST",
      body: input,
      idempotencyKey: randomUUID(),
    });
    return (data as { review: ReviewRecord }).review;
  }

  async aggregateReviews(input: {
    target: { kind: string; submissionId?: string; candidateId?: string; actionId?: string };
  }): Promise<unknown> {
    return this.request(ROUTES.reviewAggregate, {
      method: "POST",
      body: input,
    });
  }

  // ── Rewards ──────────────────────────────────────────────────────────────────

  async listRewards(query?: { actorId?: string; status?: string; limit?: number; cursor?: string }): Promise<{ items: RewardIntent[]; meta?: PageMeta }> {
    return this.list<RewardIntent>(ROUTES.rewards, query);
  }

  async getReward(id: string): Promise<RewardIntent> {
    const data = await this.request<{ reward: RewardIntent }>(ROUTES.reward(id));
    return (data as { reward: RewardIntent }).reward;
  }

  async claimReward(
    rewardIntentId: string,
    input: { actorId: string },
  ): Promise<unknown> {
    return this.request(ROUTES.rewardClaim(rewardIntentId), {
      method: "POST",
      body: input,
      idempotencyKey: randomUUID(),
    });
  }

  // ── Governance ─────────────────────────────────────────────────────────────

  async listGovernanceMerged(query?: {
    projectId?: string;
    backend?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return this.list<unknown>(ROUTES.governanceMerged, query);
  }

  async submitGovernanceOpenGov(
    governanceIntentId: string,
    input: {
      actor: string;
      payload?: unknown;
      submitArgs?: unknown;
      externalId?: string;
      subjectId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<unknown> {
    return this.request(ROUTES.governanceIntentSubmitOpenGov(governanceIntentId), {
      method: "POST",
      body: input,
      idempotencyKey: randomUUID(),
    });
  }

  async reconcileGovernanceSubject(
    governanceIntentId: string,
    input: { subjectId?: string; externalId?: string; metadata?: Record<string, unknown> },
  ): Promise<unknown> {
    return this.request(ROUTES.governanceIntentReconcileSubject(governanceIntentId), {
      method: "POST",
      body: input,
    });
  }

  async submitGovernanceVoteOpenGov(
    subjectId: string,
    input: {
      voter: string;
      stance: string;
      weight?: string;
      reason?: string;
      conviction?: string | number;
      payload?: unknown;
      metadata?: Record<string, unknown>;
    },
  ): Promise<unknown> {
    return this.request(ROUTES.governanceSubjectVoteOpenGov(subjectId), {
      method: "POST",
      body: input,
      idempotencyKey: randomUUID(),
    });
  }

  async listGovernanceSubjects(query?: {
    backend?: string;
    chainId?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return this.list<unknown>(ROUTES.governanceSubjects, query);
  }

  async getGovernanceCheckpoint(query?: {
    backend?: string;
    chainId?: string;
  }): Promise<{ checkpoint: unknown | null; items?: unknown[] }> {
    const qs = query ? buildQueryString(query) : "";
    return this.request<{ checkpoint: unknown | null; items?: unknown[] }>(
      `${ROUTES.governanceCheckpoint}${qs}`,
    );
  }

  async listGovernanceBackends(): Promise<{ items: unknown[] }> {
    const data = await this.request<{ backends?: unknown[] }>(ROUTES.governanceBackends);
    return { items: data.backends ?? [] };
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  async listEvents(query?: {
    type?: string;
    correlationId?: string;
    from?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: EventEnvelope[]; meta?: PageMeta }> {
    return this.list<EventEnvelope>(ROUTES.events, query);
  }

  async getEvent(id: string): Promise<EventEnvelope> {
    const data = await this.request<{ event: EventEnvelope }>(ROUTES.event(id));
    return (data as { event: EventEnvelope }).event;
  }

  // ── Traces ───────────────────────────────────────────────────────────────────

  async listTraces(query?: { limit?: number; cursor?: string }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return this.list<unknown>(ROUTES.traces, query);
  }

  async getTrace(id: string): Promise<unknown> {
    return this.request(ROUTES.trace(id));
  }

  async verifyTrace(id: string): Promise<unknown> {
    return this.request(ROUTES.traceVerify(id), { method: "POST", body: {} });
  }

  async replayTrace(id: string): Promise<unknown> {
    return this.request(ROUTES.traceReplay(id), { method: "POST", body: {} });
  }

  // ── Phase F ──────────────────────────────────────────────────────────────────

  async runPhaseFSmoke(): Promise<unknown> {
    return this.request(ROUTES.phaseFSmoke, { method: "POST", body: {} });
  }

  async listPhaseFRuns(query?: { limit?: number; cursor?: string }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return this.list<unknown>(ROUTES.phaseFRuns, query);
  }

  // ── Phase H ──────────────────────────────────────────────────────────────────

  async runPhaseHSmoke(): Promise<unknown> {
    return this.request(ROUTES.phaseHSmoke, { method: "POST", body: {} });
  }

  async listPhaseHRuns(query?: { projectId?: string; limit?: number; cursor?: string }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return this.list<unknown>(ROUTES.phaseHRuns, query);
  }

  async getPhaseHOverview(projectId: string): Promise<unknown> {
    return this.request(ROUTES.phaseHOverview(projectId));
  }

  async listGuardianRequests(query?: { projectId?: string; actionId?: string; status?: string; limit?: number; cursor?: string }): Promise<{ items: unknown[]; meta?: PageMeta }> {
    return this.list<unknown>(ROUTES.guardianRequests, query);
  }

  /** Base URL for SSE stream */
  getStreamUrl(projectId?: string): string {
    if (projectId) return `${this.baseUrl}${ROUTES.projectStream(projectId)}`;
    return `${this.baseUrl}${ROUTES.streamEvents}`;
  }

  getAuthToken(): string {
    return this.token;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
