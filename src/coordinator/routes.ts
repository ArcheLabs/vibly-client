/** Coordinator URL constants */
export const ROUTES = {
  health: "/health",

  principals: "/principals",
  principal: (id: string) => `/principals/${id}`,
  principalIdentities: (id: string) => `/principals/${id}/identities`,
  principalStatus: (id: string) => `/principals/${id}/status`,

  agents: "/agents",
  agent: (id: string) => `/agents/${id}`,
  agentStatus: (id: string) => `/agents/${id}/status`,
  agentRuntimeBindings: (agentId: string) => `/agents/${agentId}/runtime-bindings`,
  agentRuntimeBinding: (agentId: string, bindingId: string) =>
    `/agents/${agentId}/runtime-bindings/${bindingId}`,

  projects: "/projects",
  project: (id: string) => `/projects/${id}`,
  projectActivate: (id: string) => `/projects/${id}/activate`,
  projectPause: (id: string) => `/projects/${id}/pause`,
  projectArchive: (id: string) => `/projects/${id}/archive`,
  projectObjectives: (id: string) => `/projects/${id}/objectives`,
  projectBoundary: (id: string) => `/projects/${id}/boundary`,
  projectStateLatest: (id: string) => `/projects/${id}/state/latest`,
  projectMembers: (id: string) => `/projects/${id}/members`,
  projectMember: (id: string, principalId: string) =>
    `/projects/${id}/members/${principalId}`,

  objectives: "/objectives",
  objective: (id: string) => `/objectives/${id}`,
  objectiveActivate: (id: string) => `/objectives/${id}/activate`,
  objectiveClose: (id: string) => `/objectives/${id}/close`,

  contextBundles: "/context/bundles",
  contextBundle: (id: string) => `/context/bundles/${id}`,
  contextReceipts: "/context/receipts",

  knowledgeLatest: "/knowledge/latest",
  knowledgeVersions: "/knowledge/versions",
  knowledgeVersion: (id: string) => `/knowledge/versions/${id}`,
  knowledgeCandidates: "/knowledge/candidates",
  knowledgeCandidate: (id: string) => `/knowledge/candidates/${id}`,
  knowledgeCommits: "/knowledge/commits",

  workOrders: "/work-orders",
  workOrdersOpen: "/work-orders/open",
  workOrder: (id: string) => `/work-orders/${id}`,
  workOrderClaim: (id: string) => `/work-orders/${id}/claim`,
  workOrderSubmit: (id: string) => `/work-orders/${id}/submit`,
  workOrderCancel: (id: string) => `/work-orders/${id}/cancel`,

  negotiations: "/negotiations",
  negotiation: (id: string) => `/negotiations/${id}`,
  negotiationPositions: (id: string) => `/negotiations/${id}/positions`,
  negotiationClose: (id: string) => `/negotiations/${id}/close`,

  reviewRequests: "/reviews/requests",
  reviews: "/reviews",
  reviewAggregate: "/reviews/aggregate",

  rewards: "/rewards",
  reward: (id: string) => `/rewards/${id}`,
  rewardReserve: (id: string) => `/rewards/${id}/reserve`,
  rewardClaim: (id: string) => `/rewards/${id}/claim`,

  governanceMerged: "/governance/merged",
  governanceIntentSubmitOpenGov: (id: string) => `/governance/intents/${id}/submit-opengov`,
  governanceIntentReconcileSubject: (id: string) => `/governance/intents/${id}/reconcile-subject`,
  governanceSubjectVoteOpenGov: (id: string) => `/governance/subjects/${encodeURIComponent(id)}/vote-opengov`,
  governanceSubjects: "/governance/subjects",
  governanceCheckpoint: "/governance/checkpoint",
  governanceBackends: "/governance/backends",

  events: "/events",
  event: (id: string) => `/events/${id}`,
  streamEvents: "/streams/events",
  projectStream: (id: string) => `/projects/${id}/stream`,

  traces: "/traces",
  trace: (id: string) => `/traces/${id}`,
  traceVerify: (id: string) => `/traces/${id}/verify`,
  traceReplay: (id: string) => `/traces/${id}/replay`,
  projectTraces: (id: string) => `/projects/${id}/traces`,
} as const;
