# P2：Vibly Client CLI / Daemon 实现文档

版本：v0.1  
适用仓库：`vibly-client`  
依赖：`concord-sdk` / `ascf-sdk`、`vibly-coordinator` P1  
用途：交给 Codex 直接实现  
状态：实现说明，不是最终协议规范

---

## 1. 背景

当前系统已完成：

- Concord / ASCF SDK 协议内核
- M8 Protocol Trace / Replay / Verify / Scenario DSL
- M9 Project / Objective / Boundary / Principal / Agent / RuntimeBinding
- P1 Vibly Coordinator 产品化设计

P2 的目标是实现 `vibly-client`，也就是 Agent 实际接入 Vibly 协作网络的客户端。

`vibly-client` 不是普通前端，也不是单 Agent runtime。它是一个 **Agent 节点客户端**，负责连接 Coordinator、同步上下文和知识、领取任务、调用本地或外部 runtime、提交执行结果、参与协商 / 投票 / 评审，并查看奖励状态。

第一版允许依赖中心化 `vibly-coordinator`。但客户端架构必须避免强绑定 coordinator 的实现细节，未来应能替换为：

- P2P coordination
- chain event driven coordination
- multi-coordinator network
- hybrid coordination mode

---

## 2. P2 总目标

实现一个可以本地运行的 `vibly-client`，支持 CLI 和 daemon 两种模式。

P2 完成后，一个 Agent 运行者应能：

1. 配置 Coordinator 地址和 API Token
2. 注册或导入 Principal
3. 注册 Agent
4. 创建 RuntimeBinding
5. 同步 Project / Objective / Boundary
6. 同步 StateView / KnowledgeVersion / ContextBundle
7. 查看可领取 WorkOrder
8. 领取 WorkOrder
9. 调用本地 Script Runtime 执行任务
10. 生成 ExecutionReceipt
11. 提交 Submission
12. 查看待参与的 Delegate Vote / Negotiation
13. 提交 vote / position
14. 查看待评审 Submission
15. 提交 Review
16. 查看 RewardIntent / Claim 状态
17. 订阅 Coordinator SSE 事件流
18. 本地缓存事件、状态、知识和任务
19. 支持 daemon 自动轮询 / 自动执行可配置任务
20. 支持一条端到端 demo loop

---

## 3. 非目标

P2 不实现：

- 完整桌面 GUI
- 浏览器插件
- 移动端客户端
- 真实钱包签名
- 真实链上交易
- P2P 网络
- 复杂 agent sandbox
- 完整 OpenClaw 集成
- 完整 A2A 集成
- MCP tool marketplace
- 复杂权限系统
- 多账号商业 SaaS 管理后台
- 完整知识向量库
- 自动生成协商协议
- 复杂 reputation score
- 真实 reward claim 上链

P2 可以实现 adapter 接口、mock、占位和扩展点，但不能把 OpenGov / EVM / Vibly Chain 具体逻辑写死进 client core。

---

## 4. 产品边界

### 4.1 `vibly-client` 负责

```txt
Agent-side CLI
Agent-side daemon
Coordinator API client
SSE event subscription
Local cache
Local runtime host
WorkOrder execution
Submission creation
ContextReceipt management
ExecutionReceipt creation
Vote / negotiation participation
Review participation
Reward status query
Local config and identity profile
```

### 4.2 `vibly-client` 不负责

```txt
Coordinator server logic
Final state projection authority
Final knowledge authority
Final reward settlement
Final governance execution
Chain-specific execution
Human admin console
Protocol core implementation
```

### 4.3 与其他仓库关系

```txt
concord-sdk:
  domain types, ports, receipts, trace utilities, runtime adapter contracts

vibly-coordinator:
  HTTP API, event store, projections, assignments, task distribution

vibly-client:
  agent node / CLI / daemon, consumes coordinator APIs

vibly-console:
  human visualization and guardian/admin surface

vibly-chain:
  staking, settlement, hash registry, address binding
```

---

## 5. 推荐技术栈

使用 TypeScript / Node.js。

推荐：

```txt
Node.js >= 20
TypeScript
pnpm
commander
zod
undici 或 native fetch
eventsource-parser
better-sqlite3 或 libsql
pino
dotenv
execa
chokidar
vitest
tsx
```

可选：

```txt
ink
ora
enquirer
yaml
```

P2 不强制 TUI。CLI 输出保持稳定、易测试即可。

---

## 6. 推荐仓库结构

```txt
vibly-client/
  package.json
  pnpm-workspace.yaml
  tsconfig.json
  README.md
  .env.example
  .gitignore

  src/
    main.ts

    cli/
      index.ts
      commands/
        config.ts
        login.ts
        principal.ts
        agent.ts
        project.ts
        sync.ts
        context.ts
        knowledge.ts
        work.ts
        vote.ts
        negotiation.ts
        review.ts
        rewards.ts
        daemon.ts
        runtime.ts
        status.ts
        events.ts
        trace.ts

    daemon/
      daemon.ts
      loop.ts
      scheduler.ts
      handlers/
        workHandler.ts
        voteHandler.ts
        negotiationHandler.ts
        reviewHandler.ts
        syncHandler.ts
        rewardHandler.ts

    coordinator/
      client.ts
      errors.ts
      routes.ts
      types.ts
      pagination.ts
      sse.ts

    config/
      config.ts
      paths.ts
      profiles.ts
      env.ts

    local/
      database.ts
      migrations.ts
      schema.sql
      stores/
        localEventStore.ts
        localProjectStore.ts
        localAgentStore.ts
        localContextStore.ts
        localKnowledgeStore.ts
        localWorkStore.ts
        localRuntimeStore.ts
        localSyncStateStore.ts

    runtime/
      runtimeHost.ts
      runtimeRegistry.ts
      adapters/
        scriptRuntime.ts
        mockRuntime.ts
        humanAssistedRuntime.ts
      receipts.ts
      sandbox.ts

    services/
      syncService.ts
      contextService.ts
      knowledgeSyncService.ts
      workService.ts
      voteService.ts
      negotiationService.ts
      reviewService.ts
      rewardService.ts
      eventStreamService.ts
      receiptService.ts
      traceService.ts

    domain/
      errors.ts
      ids.ts
      apiTypes.ts
      clientTypes.ts
      result.ts

    schemas/
      config.ts
      principal.ts
      agent.ts
      runtime.ts
      work.ts
      review.ts
      vote.ts
      daemon.ts

  examples/
    profiles/
      local-agent.json
    runtimes/
      research-agent.js
      review-agent.js
    scripts/
      demo-loop.sh

  tests/
    unit/
    integration/
    e2e/
    fixtures/
```

---

## 7. 本地目录结构

默认本地数据目录：

```txt
~/.vibly/
  config.json
  profiles/
    default.json
  data/
    client.sqlite
  knowledge/
    <projectId>/
      versions/
      materialized/
      artifacts/
  runtime/
    logs/
    outputs/
  traces/
  cache/
```

允许通过环境变量覆盖：

```bash
VIBLY_HOME=/custom/path
```

---

## 8. 配置模型

### 8.1 `.env.example`

```bash
VIBLY_HOME=~/.vibly
VIBLY_PROFILE=default

VIBLY_COORDINATOR_URL=http://localhost:8787
VIBLY_API_TOKEN=dev-token

VIBLY_LOG_LEVEL=info

VIBLY_DAEMON_POLL_INTERVAL_MS=10000
VIBLY_DAEMON_ENABLE_SSE=true

VIBLY_DEFAULT_RUNTIME=script-local
```

### 8.2 `config.json`

```json
{
  "version": "0.1.0",
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "coordinatorUrl": "http://localhost:8787",
      "apiTokenRef": "env:VIBLY_API_TOKEN",
      "localDatabase": "~/.vibly/data/client.sqlite"
    }
  }
}
```

### 8.3 Profile

```json
{
  "name": "default",
  "coordinatorUrl": "http://localhost:8787",
  "principalId": "principal_...",
  "agentId": "agent_...",
  "projectId": "project_...",
  "defaultRuntimeBindingId": "runtime_binding_...",
  "apiTokenRef": "env:VIBLY_API_TOKEN",
  "sync": {
    "enableSse": true,
    "pollIntervalMs": 10000
  },
  "daemon": {
    "autoClaim": false,
    "autoRun": false,
    "autoVote": false,
    "autoReview": false
  }
}
```

### 8.4 配置命令

```bash
vibly config init
vibly config show
vibly config set coordinatorUrl http://localhost:8787
vibly config set apiToken dev-token
vibly profile list
vibly profile use default
vibly profile create local-agent
```

---

## 9. 本地数据库

使用 SQLite。

### 9.1 local_events

保存从 Coordinator 同步的事件。

```sql
CREATE TABLE IF NOT EXISTS local_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  actor_id TEXT,
  correlation_id TEXT,
  envelope_json TEXT NOT NULL,
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_events_type ON local_events(type);
CREATE INDEX IF NOT EXISTS idx_local_events_timestamp ON local_events(timestamp);
```

### 9.2 local_entities

通用本地缓存。

```sql
CREATE TABLE IF NOT EXISTS local_entities (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);

CREATE INDEX IF NOT EXISTS idx_local_entities_kind ON local_entities(kind);
```

kind 至少包括：

```txt
project
objective
boundary
principal
agent
runtime_binding
context_bundle
context_receipt
state_view
knowledge_version
work_order
submission
negotiation
review
reward_intent
```

### 9.3 sync_state

记录同步游标。

```sql
CREATE TABLE IF NOT EXISTS sync_state (
  scope TEXT PRIMARY KEY,
  cursor TEXT,
  last_synced_at TEXT,
  metadata_json TEXT
);
```

scope 示例：

```txt
events:global
events:project:<projectId>
work:open:<projectId>
knowledge:<projectId>
```

### 9.4 runtime_runs

记录 runtime 执行历史。

```sql
CREATE TABLE IF NOT EXISTS runtime_runs (
  id TEXT PRIMARY KEY,
  work_order_id TEXT,
  runtime_binding_id TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  input_json TEXT,
  output_json TEXT,
  execution_receipt_json TEXT,
  logs_path TEXT,
  error_json TEXT
);
```

---

## 10. Coordinator API Client

实现 `CoordinatorClient`，封装 HTTP 和 SSE。

### 10.1 接口

```ts
export interface CoordinatorClient {
  health(): Promise<HealthResponse>;

  listProjects(input?: ListProjectsInput): Promise<Project[]>;
  getProject(projectId: string): Promise<Project>;

  listObjectives(projectId: string): Promise<Objective[]>;
  getBoundary(projectId: string): Promise<Boundary | null>;

  registerPrincipal(input: RegisterPrincipalInput): Promise<Principal>;
  registerAgent(input: RegisterAgentInput): Promise<Agent>;
  createRuntimeBinding(agentId: string, input: CreateRuntimeBindingInput): Promise<RuntimeBinding>;

  createContextBundle(input: CreateContextBundleInput): Promise<ContextBundle>;
  acceptContextBundle(contextBundleId: string, actorId: string): Promise<ContextReceipt>;

  getLatestState(projectId: string): Promise<StateView>;
  getLatestKnowledge(projectId: string): Promise<KnowledgeVersion>;

  listOpenWorkOrders(input: ListOpenWorkOrdersInput): Promise<WorkOrder[]>;
  getWorkOrder(workOrderId: string): Promise<WorkOrder>;
  claimWorkOrder(workOrderId: string, actorId: string): Promise<WorkClaim>;
  submitWorkOrder(workOrderId: string, input: SubmitWorkInput): Promise<Submission>;

  listNegotiations(input: ListNegotiationsInput): Promise<NegotiationInstance[]>;
  submitNegotiationPosition(negotiationId: string, input: SubmitPositionInput): Promise<NegotiationInstance>;

  listReviewRequests(input: ListReviewRequestsInput): Promise<ReviewRequest[]>;
  submitReview(input: SubmitReviewInput): Promise<ReviewRecord>;

  listRewards(input: ListRewardsInput): Promise<RewardIntent[]>;
  claimReward(rewardIntentId: string, actorId: string): Promise<SettlementReceipt>;

  listEvents(input: ListEventsInput): Promise<EventEnvelope[]>;
  streamEvents(input: StreamEventsInput): AsyncIterable<EventEnvelope>;
}
```

### 10.2 HTTP 规则

- 所有请求必须带 `Authorization: Bearer <token>`
- 所有响应统一解析 `{ ok, data, error, meta }`
- 非 2xx 或 `ok=false` 必须抛出 `CoordinatorApiError`
- 需要支持 retry，但只对 GET / idempotent 请求默认 retry
- POST 默认不 retry，除非明确提供 idempotency key

### 10.3 Idempotency Key

为关键写入请求支持：

```http
Idempotency-Key: <uuid>
```

适用：

```txt
claim work
submit work
submit vote
submit review
claim reward
```

P2 只需要 client 生成并发送，Coordinator 若尚未支持，可忽略。

---

## 11. CLI 设计

CLI 名称：

```bash
vibly
```

全局参数：

```bash
--profile <name>
--config <path>
--json
--verbose
--coordinator-url <url>
--api-token <token>
```

### 11.1 基础命令

```bash
vibly --help
vibly status
vibly health
```

`vibly status` 显示：

```txt
Profile
Coordinator URL
Principal ID
Agent ID
Project ID
Latest StateView
Latest KnowledgeVersion
Open WorkOrders count
Pending votes count
Pending reviews count
Rewards count
Daemon status
```

### 11.2 Config / Profile

```bash
vibly config init
vibly config show
vibly config set <key> <value>

vibly profile list
vibly profile create <name>
vibly profile use <name>
vibly profile show
```

### 11.3 Login

P2 不做真实 OAuth / wallet login。

```bash
vibly login --coordinator http://localhost:8787 --token dev-token
```

行为：

1. 写入 profile
2. 调用 `/health`
3. 成功后显示 coordinator 信息

### 11.4 Principal

```bash
vibly principal register \
  --display-name "Dk Lee" \
  --kind human \
  --identity wallet:polkadot:5xxx

vibly principal show
vibly principal bind-identity --namespace github --subject ArcheLabs
```

### 11.5 Agent

```bash
vibly agent register \
  --display-name research-agent-1 \
  --capability research \
  --capability review \
  --role member \
  --role observer \
  --role delegate \
  --role reviewer

vibly agent show
vibly agent availability online
vibly agent availability offline
```

### 11.6 Runtime

```bash
vibly runtime list
vibly runtime register-script \
  --name script-local \
  --command "node ./examples/runtimes/research-agent.js" \
  --capability research

vibly runtime test --runtime script-local
vibly runtime logs
```

### 11.7 Project

```bash
vibly project list
vibly project use <projectId>
vibly project show
vibly project objectives
vibly project boundary
```

### 11.8 Sync

```bash
vibly sync
vibly sync events
vibly sync context
vibly sync knowledge
vibly sync work
vibly sync all
```

### 11.9 Context

```bash
vibly context latest
vibly context create --purpose work_execution
vibly context accept <contextBundleId>
vibly context receipts
```

### 11.10 Knowledge

```bash
vibly knowledge latest
vibly knowledge pull
vibly knowledge status
vibly knowledge versions
```

P2 的 `knowledge pull` 可以只同步 metadata 和 artifact refs，不需要完整 materialization。

### 11.11 Work

```bash
vibly work list
vibly work open
vibly work show <workOrderId>
vibly work claim <workOrderId>
vibly work run <workOrderId>
vibly work submit <workOrderId> --artifact ./output.md --summary "..."
vibly work run-and-submit <workOrderId>
```

### 11.12 Vote / Negotiation

```bash
vibly vote list
vibly vote show <negotiationId>
vibly vote submit <negotiationId> --stance support --rationale "..."

vibly negotiation list
vibly negotiation show <negotiationId>
vibly negotiation position <negotiationId> --stance revise --rationale "..." --score 0.7
```

### 11.13 Review

```bash
vibly review list
vibly review show <reviewRequestId>
vibly review submit <reviewRequestId> --result accept --score 0.9 --rationale "..."
```

### 11.14 Rewards

```bash
vibly rewards
vibly rewards show <rewardIntentId>
vibly rewards claim <rewardIntentId>
```

### 11.15 Events / Trace

```bash
vibly events tail
vibly events list --type WorkOrderCreated
vibly trace list
vibly trace verify <traceId>
vibly trace replay <traceId>
```

### 11.16 Daemon

```bash
vibly daemon start
vibly daemon once
vibly daemon status
vibly daemon stop
```

P2 可以不实现真正后台进程管理，`daemon start` 可以以前台 long-running process 运行。

---

## 12. Daemon 模式

Daemon 是 Agent 自动参与网络的本地进程。

### 12.1 Daemon Loop

```txt
1. Load profile
2. Connect coordinator
3. Sync project state
4. Subscribe SSE if enabled
5. Periodically poll:
   - open work orders
   - assigned work
   - pending votes
   - pending negotiations
   - pending reviews
   - rewards
6. For each item:
   - check local policy
   - decide whether to act
   - invoke service
7. Persist local sync state
8. Continue
```

### 12.2 自动化配置

```json
{
  "daemon": {
    "autoClaim": false,
    "autoRun": false,
    "autoSubmit": false,
    "autoVote": false,
    "autoReview": false,
    "autoClaimRewards": false,
    "maxConcurrentWork": 1,
    "allowedWorkTypes": ["research", "summarize"],
    "deniedWorkTypes": ["fund_transfer"],
    "requireManualApprovalForRisk": ["high", "critical"]
  }
}
```

默认所有自动执行均关闭。

### 12.3 安全默认值

P2 默认：

```txt
autoClaim = false
autoRun = false
autoSubmit = false
autoVote = false
autoReview = false
autoClaimRewards = false
```

也就是说，daemon 默认只同步和提示，不自动行动。

用户显式启用后才自动领取或执行任务。

### 12.4 Handler

实现以下 handlers：

```txt
WorkHandler
VoteHandler
NegotiationHandler
ReviewHandler
SyncHandler
RewardHandler
```

每个 handler 应返回：

```ts
interface HandlerResult {
  handled: boolean;
  action?: string;
  reason?: string;
  artifacts?: ArtifactRef[];
  error?: unknown;
}
```

---

## 13. Runtime Host

Runtime Host 负责调用本地或外部 Agent runtime。

### 13.1 RuntimeHost 接口

```ts
export interface RuntimeHost {
  listBindings(): Promise<RuntimeBinding[]>;

  execute(input: RuntimeExecutionInput): Promise<RuntimeExecutionResult>;

  test(input: RuntimeTestInput): Promise<RuntimeTestResult>;
}
```

### 13.2 RuntimeExecutionInput

```ts
export interface RuntimeExecutionInput {
  agentId: string;
  runtimeBindingId: string;
  workOrder: WorkOrder;
  contextBundle: ContextBundle;
  contextReceipt: ContextReceipt;
  localKnowledgePath?: string;
  workingDirectory: string;
}
```

### 13.3 RuntimeExecutionResult

```ts
export interface RuntimeExecutionResult {
  status: "success" | "failed" | "partial";

  summary: string;
  artifacts: ArtifactRef[];

  stdout?: string;
  stderr?: string;

  startedAt: string;
  finishedAt: string;

  outputHash?: Hash;
  executionReceipt: ExecutionReceipt;
}
```

### 13.4 Script Runtime

P2 必须实现 `script` runtime。

配置：

```json
{
  "runtimeType": "script",
  "command": "node ./examples/runtimes/research-agent.js",
  "env": {
    "MODEL": "mock"
  },
  "timeoutMs": 300000
}
```

调用时传入环境变量：

```bash
VIBLY_WORK_ORDER_JSON=<path>
VIBLY_CONTEXT_BUNDLE_JSON=<path>
VIBLY_CONTEXT_RECEIPT_JSON=<path>
VIBLY_OUTPUT_DIR=<path>
VIBLY_KNOWLEDGE_DIR=<path>
```

Script Runtime 输出约定：

```txt
stdout may contain logs
output directory must contain:
  result.json
  artifacts/*
```

`result.json`：

```json
{
  "status": "success",
  "summary": "Completed research task.",
  "artifacts": [
    {
      "path": "artifacts/report.md",
      "mediaType": "text/markdown"
    }
  ]
}
```

Runtime Host 负责：

1. 创建临时工作目录
2. 写入 work/context/receipt JSON
3. 启动命令
4. 收集 stdout / stderr
5. 读取 result.json
6. 计算 artifact hash
7. 生成 ArtifactRef
8. 生成 ExecutionReceipt
9. 保存 runtime_runs

### 13.5 Mock Runtime

用于测试。

行为：

```txt
Given WorkOrder, generate deterministic markdown artifact.
```

### 13.6 Human-assisted Runtime

P2 可实现最小版本：

```bash
vibly work run <workOrderId> --runtime human
```

行为：

1. 打印任务详情
2. 提示用户手动输入 summary
3. 用户提供 artifact path
4. 生成 ExecutionReceipt

---

## 14. Work 执行流程

### 14.1 手动流程

```bash
vibly sync
vibly work open
vibly work claim <workOrderId>
vibly context create --purpose work_execution
vibly context accept <contextBundleId>
vibly work run <workOrderId>
vibly work submit <workOrderId>
```

### 14.2 `run-and-submit`

```bash
vibly work run-and-submit <workOrderId>
```

行为：

1. 获取 WorkOrder
2. 如果未 claim，则 claim
3. 获取或创建 ContextBundle
4. accept context，生成 ContextReceipt
5. 调用 RuntimeHost
6. 生成 ExecutionReceipt
7. 提交 Submission
8. 本地保存 Submission 和 runtime run
9. 输出 submission id

### 14.3 Context 校验

提交前必须校验：

```txt
contextReceipt exists
contextReceipt.actorId == agentId
contextReceipt.knowledgeHash matches latest or accepted policy
contextReceipt.stateViewVersion exists
executionReceipt.inputContext matches contextReceipt
```

如果 Coordinator 返回 `CONTEXT_INVALID`，CLI 应提示：

```txt
Context is stale or invalid. Run `vibly sync context` and retry.
```

---

## 15. Vote / Negotiation 参与

### 15.1 Vote list

`vibly vote list` 应查询：

```txt
assigned delegate votes
open negotiations where agent is participant
project negotiations where role allows participation
```

### 15.2 Submit vote

```bash
vibly vote submit <negotiationId> --stance support --rationale "..."
```

stance：

```txt
support
oppose
abstain
revise
escalate
```

P2 映射到 coordinator 的 negotiation position API。

### 15.3 自动投票

默认关闭。

如果启用 `autoVote`，P2 只允许对低风险、明确 policy、配置有本地规则的 vote 自动投票。

本地规则示例：

```json
{
  "autoVoteRules": [
    {
      "actionType": "create_research_task",
      "maxRiskLevel": "medium",
      "stance": "support",
      "rationale": "Auto-support research tasks within project boundary."
    }
  ]
}
```

无匹配规则时不得自动投票。

---

## 16. Review 参与

### 16.1 Review list

```bash
vibly review list
```

显示：

```txt
reviewRequestId
target kind
target id
deadline
criteria
status
```

### 16.2 Submit review

```bash
vibly review submit <reviewRequestId> \
  --result accept \
  --score 0.9 \
  --rationale "Meets all criteria"
```

result：

```txt
accept
reject
needs_revision
escalate
```

### 16.3 Runtime-assisted review

P2 可提供：

```bash
vibly review run <reviewRequestId> --runtime script-local
```

行为：

1. 获取 target submission
2. 创建 review context
3. 调用 runtime
4. 生成人类可查看 review draft
5. 默认不自动提交，除非 `--submit`

---

## 17. Knowledge Sync

P2 的知识同步分两层：

### 17.1 Metadata sync

必须实现：

```txt
latest KnowledgeVersion
KnowledgeVersion list
KnowledgeHash
KnowledgeCandidate refs
KnowledgeCommit refs
ArtifactRef list
```

### 17.2 Artifact pull

P2 可实现简单 artifact pull：

```bash
vibly knowledge pull
```

行为：

1. 查询 latest KnowledgeVersion
2. 获取 artifact refs
3. 如果 uri 是 HTTP，则下载到本地
4. 如果 uri 是 file，则在本地 dev 模式复制或记录引用
5. 保存到 `~/.vibly/knowledge/<projectId>/`

### 17.3 不做向量化

P2 不实现向量库和语义检索。

Runtime 可以直接读取 materialized markdown / JSON 文件。

---

## 18. Event Sync / SSE

### 18.1 Poll Sync

```bash
vibly sync events
```

调用：

```txt
GET /events?cursor=<lastCursor>
```

保存到 `local_events`。

### 18.2 SSE

```bash
vibly events tail
```

连接：

```txt
GET /streams/events
```

或：

```txt
GET /projects/:projectId/stream
```

每收到事件：

1. 打印摘要
2. 写入 local_events
3. 更新相关 local_entities
4. 触发 daemon handlers

### 18.3 断线重连

SSE 断线后：

```txt
exponential backoff
max 30s
resume using last event cursor if supported
fallback to poll sync
```

---

## 19. Receipt 管理

Client 必须本地保存：

```txt
ContextReceipt
ExecutionReceipt
Submission receipt
Vote / position receipt
Review receipt
Reward claim receipt
```

### 19.1 ReceiptService

```ts
interface ReceiptService {
  saveReceipt(input: SaveReceiptInput): Promise<void>;
  listReceipts(input: ListReceiptsInput): Promise<ClientReceipt[]>;
  getReceipt(id: string): Promise<ClientReceipt | null>;
}
```

### 19.2 ExecutionReceipt

必须包含：

```txt
runtime id
agent id
startedAt
finishedAt
input context receipt
tool calls if any
logs/artifacts refs
output hash
status
```

---

## 20. 本地安全策略

### 20.1 风险等级处理

Client 必须识别 riskLevel：

```txt
low
medium
high
critical
```

默认策略：

```txt
low: allow manual execution
medium: allow manual execution
high: require explicit --confirm
critical: refuse automatic execution, require --confirm-critical
```

### 20.2 自动执行限制

daemon 自动执行时：

```txt
only low / medium
never critical
never action that triggers governance / funding / slash
only allowed work types
only configured runtime
```

### 20.3 Script Runtime 风险提示

`script` runtime 是本地代码执行。

首次注册 script runtime 时必须提示：

```txt
Script runtimes execute local commands. Only register scripts you trust.
```

CLI 支持：

```bash
--yes
```

用于跳过交互。

---

## 21. 日志

使用 pino。

日志位置：

```txt
~/.vibly/runtime/logs/
~/.vibly/client.log
```

CLI 默认人类可读输出。

`--json` 输出机器可读 JSON。

日志级别：

```txt
debug
info
warn
error
```

---

## 22. 错误处理

错误码：

```txt
CONFIG_NOT_FOUND
PROFILE_NOT_FOUND
COORDINATOR_UNREACHABLE
UNAUTHORIZED
PRINCIPAL_NOT_CONFIGURED
AGENT_NOT_CONFIGURED
PROJECT_NOT_SELECTED
RUNTIME_NOT_FOUND
WORK_ORDER_NOT_FOUND
WORK_ALREADY_CLAIMED
CONTEXT_MISSING
CONTEXT_INVALID
EXECUTION_FAILED
SUBMISSION_FAILED
NEGOTIATION_NOT_FOUND
REVIEW_NOT_FOUND
REWARD_NOT_FOUND
LOCAL_DB_ERROR
```

错误输出示例：

```txt
Error: PROJECT_NOT_SELECTED
No project is selected for this profile.
Run `vibly project list` and `vibly project use <projectId>`.
```

---

## 23. JSON 输出约定

所有命令支持 `--json`。

示例：

```bash
vibly work open --json
```

输出：

```json
{
  "ok": true,
  "data": [
    {
      "id": "work_order_...",
      "title": "Research onboarding bottlenecks"
    }
  ]
}
```

错误：

```json
{
  "ok": false,
  "error": {
    "code": "PROJECT_NOT_SELECTED",
    "message": "No project is selected for this profile."
  }
}
```

---

## 24. 示例 Runtime

必须提供：

```txt
examples/runtimes/research-agent.js
examples/runtimes/review-agent.js
```

### 24.1 research-agent.js

行为：

1. 读取 `VIBLY_WORK_ORDER_JSON`
2. 读取 `VIBLY_CONTEXT_BUNDLE_JSON`
3. 在 output dir 创建 `artifacts/report.md`
4. 写 `result.json`

生成 deterministic output，方便测试。

### 24.2 review-agent.js

行为：

1. 读取 review target
2. 生成 review draft
3. 输出 accept / score / rationale

---

## 25. E2E Demo

提供脚本：

```bash
examples/scripts/demo-loop.sh
```

假设 coordinator 已运行。

流程：

```txt
1. vibly login
2. vibly principal register
3. vibly agent register
4. vibly runtime register-script
5. vibly project use <projectId>
6. vibly sync all
7. vibly work open
8. vibly work run-and-submit <workOrderId>
9. vibly review list
10. vibly review submit <reviewRequestId>
11. vibly rewards
```

由于 project / action / work order 可能由 coordinator scenario 创建，demo 脚本可以要求先运行：

```bash
pnpm --filter vibly-coordinator scenario:run examples/polkadot-adoption.yaml
```

或者使用现有 coordinator fixture。

---

## 26. 测试要求

### 26.1 Unit tests

覆盖：

```txt
config loading
profile management
coordinator client request/response parsing
API error handling
local database migrations
local entity store
runtime host
script runtime
receipt service
risk policy
```

### 26.2 Integration tests

使用 mock coordinator server，覆盖：

```txt
login
register principal
register agent
register runtime binding
sync project
sync context
sync knowledge metadata
list work orders
claim work
run script runtime
submit work
submit vote
submit review
query rewards
event sync
```

### 26.3 E2E tests

使用真实 `vibly-coordinator` 本地实例或 test app。

覆盖：

```txt
Agent registers
Agent syncs project
Agent claims work order
Agent runs script runtime
Agent submits result
Agent participates in vote
Agent submits review
Agent queries rewards
Agent tails event stream
```

### 26.4 CLI snapshot tests

对核心命令输出做快照：

```txt
vibly status
vibly work open
vibly work show
vibly rewards
```

---

## 27. Acceptance Criteria

P2 完成标准：

```txt
1. vibly CLI can install and run locally.
2. vibly login can connect to coordinator.
3. vibly principal register works.
4. vibly agent register works.
5. vibly runtime register-script works.
6. vibly project list/use/show works.
7. vibly sync all works.
8. local SQLite cache works.
9. vibly context create/accept works.
10. vibly knowledge latest/pull works at metadata level.
11. vibly work open/list/show works.
12. vibly work claim works.
13. vibly work run executes script runtime.
14. vibly work submit sends Submission with ContextReceipt and ExecutionReceipt.
15. vibly work run-and-submit works.
16. vibly vote list/submit works.
17. vibly negotiation list/position works.
18. vibly review list/submit works.
19. vibly rewards list/show/claim works against mock coordinator.
20. vibly events tail receives SSE events and saves them locally.
21. vibly daemon once runs one sync/action cycle.
22. vibly daemon start can run long-lived sync loop.
23. high/critical risk auto execution is blocked by default.
24. all major commands support --json.
25. E2E demo with coordinator passes.
```

---

## 28. Suggested Implementation Milestones

### P2.1 Bootstrap

```txt
Create repo
pnpm / tsconfig / vitest
commander CLI
config paths
logger
basic status / health
```

### P2.2 Coordinator Client

```txt
HTTP client
auth header
response parsing
error handling
pagination
SSE stream
```

### P2.3 Local Storage

```txt
SQLite migrations
local event store
local entity store
sync state store
runtime run store
```

### P2.4 Profile / Identity / Agent

```txt
login
profile management
principal register
agent register
runtime binding register
```

### P2.5 Sync

```txt
project sync
state sync
knowledge metadata sync
event sync
context create / accept
```

### P2.6 Runtime Host

```txt
script runtime
mock runtime
human assisted runtime
execution receipt
artifact hashing
runtime logs
```

### P2.7 Work Flow

```txt
work list
work claim
work run
work submit
run-and-submit
```

### P2.8 Collaboration

```txt
vote list / submit
negotiation list / position
review list / submit
```

### P2.9 Rewards / Events / Daemon

```txt
rewards list / claim
events tail
daemon once
daemon start
handlers
risk policy
```

### P2.10 Tests / Demo

```txt
unit tests
integration tests
e2e with coordinator
example runtimes
demo script
README
```

---

## 29. Codex Implementation Rules

Codex must follow these rules:

1. Do not implement coordinator server logic in `vibly-client`.
2. Do not bypass Coordinator APIs for remote state.
3. Do not bypass SDK types where they exist.
4. Do not submit work without ContextReceipt.
5. Do not submit work without ExecutionReceipt.
6. Do not auto-run high or critical risk tasks by default.
7. Do not execute script runtime without explicit runtime registration.
8. Do not hardcode OpenGov / EVM / Vibly Chain logic.
9. Keep local SQLite cache as cache, not final authority.
10. All major commands must support `--json`.
11. All write requests should use idempotency key where possible.
12. Runtime outputs must be hashed before submission.
13. Store runtime logs locally.
14. Keep CLI commands deterministic enough for tests.
15. Prefer small services over one large CLI file.
16. If coordinator API is missing, implement a thin client method with TODO and test skip, not fake protocol behavior.
17. Default daemon behavior must be safe: sync only, no automatic action.
18. Any command that may execute local script must show clear warning unless `--yes`.
19. Preserve future compatibility with P2P / multi-coordinator by isolating CoordinatorClient behind interface.
20. Keep README commands accurate and runnable.

---

## 30. README Requirements

README must include:

```txt
What is Vibly Client
What it is not
Architecture overview
Install
Config
Connect to Coordinator
Register Principal
Register Agent
Register Runtime
Sync project
Run work manually
Run daemon
Participate in vote
Submit review
View rewards
Local data directory
Security notes for script runtime
Development commands
Testing
```

Minimal README quickstart:

```bash
pnpm install
pnpm build

vibly login --coordinator http://localhost:8787 --token dev-token

vibly principal register --display-name "Local Principal" --kind human

vibly agent register \
  --display-name local-agent \
  --capability research \
  --capability review \
  --role member \
  --role reviewer

vibly runtime register-script \
  --name script-local \
  --command "node ./examples/runtimes/research-agent.js" \
  --capability research

vibly project list
vibly project use <projectId>
vibly sync all
vibly work open
vibly work run-and-submit <workOrderId>
```

---

## 31. Example Command Flow

Assuming coordinator is running at `http://localhost:8787`.

```bash
vibly login \
  --coordinator http://localhost:8787 \
  --token dev-token
```

```bash
vibly principal register \
  --display-name "Local Operator" \
  --kind human
```

```bash
vibly agent register \
  --display-name "research-agent-1" \
  --capability research \
  --capability review \
  --role member \
  --role observer \
  --role delegate \
  --role reviewer
```

```bash
vibly runtime register-script \
  --name research-script \
  --command "node ./examples/runtimes/research-agent.js" \
  --capability research
```

```bash
vibly project list
vibly project use <projectId>
vibly sync all
```

```bash
vibly work open
vibly work claim <workOrderId>
vibly work run-and-submit <workOrderId>
```

```bash
vibly review list
vibly review submit <reviewRequestId> \
  --result accept \
  --score 0.9 \
  --rationale "Meets the acceptance criteria."
```

```bash
vibly rewards
```

---

## 32. Definition of Done

P2 is complete when:

```txt
A developer can run vibly-coordinator locally,
run vibly-client locally,
register a principal and agent,
bind a script runtime,
sync project context and knowledge,
list open work,
claim and execute a WorkOrder,
submit a Submission with ContextReceipt and ExecutionReceipt,
participate in delegate vote / negotiation,
submit a review,
query reward status,
tail coordinator events,
and run a safe daemon loop that does not perform risky actions automatically.
```

---

## 33. Future Extensions

After P2, future work may include:

```txt
OpenClaw runtime adapter
A2A runtime adapter
MCP tool adapter
wallet-based identity
signature support
multi-coordinator mode
P2P event sync
local vector knowledge cache
TUI
desktop client
browser runtime
advanced auto-agent policies
real Vibly Chain claim
```

These are intentionally outside P2.
