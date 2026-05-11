# Vibly Client v0.2 重构计划

版本：v0.2  
基于文档：`vibly_client_refactor_v0_2_implementation_plan.md`、`Vibly_DDD_Architecture_v0.2.md`  
日期：2026-05-09

---

## 一、现状分析

### 现有代码结构（已有基础）

```
src/
  cli/commands/
    core/         config, login, status
    identity/     agent, principal, runtime
    workflow/     context, knowledge, project, review, rewards, work
    governance/   governance, negotiation, vote
    observability/ daemon, events, sync, trace
    dev/          scenarios, phase-aliases
  coordinator/    client.ts (914行), contractClient.ts, sse.ts, types.ts
  daemon/         daemon.ts, loop.ts, handlers/{work,vote,negotiation,review,reward,sync}
  local/          database.ts, migrations.ts, stores/{entity,event,runtime,sync,work}
  runtime/        runtimeHost.ts, adapters/{script,mock,humanAssisted}
  schemas/        agent, config, daemon, principal, review, runtime, vote, work
  domain/         clientTypes.ts, apiTypes.ts, errors.ts
  config/         config.ts, profiles.ts, paths.ts, logger.ts, env.ts
  chain/          (substrate adapter)
```

### 存在的问题

1. **写操作没有统一走 ActionIntent**：`claimWorkOrder`/`submitWorkOrder`/`submitNegotiationPosition`/`submitReview` 等方法直接调用各自 REST 端点，没有封装为 `POST /action-intents`。
2. **缺少 v0.2 领域对象**：Organization、ProjectHandbook、MechanismRegistry、ObservationAssignment、DiscussionParticipation、VotingRound 等队列全部缺失。
3. **CLI 命令语义是旧的**：`vibly work list/claim/run/submit` 对应旧 WorkOrder 语义；缺少 `vibly queue obligations/observations/discussions/tasks/reviews/votes`。
4. **sync 命令不完整**：只同步 project/objectives/work-orders，缺少 organization/handbook/mechanism/queue snapshot。
5. **daemon loop 不完整**：handler 仍使用旧语义，缺少 observationAssignmentHandler/discussionParticipationHandler 等。
6. **本地 store 缺失**：LocalOrganizationStore/LocalHandbookStore/LocalMechanismStore/LocalQueueStore 尚不存在。
7. **protocol snapshot 检查缺失**：无版本兼容性检查。
8. **dev alias 冗余**：`phase-f`/`phase-h` 别名应彻底删除，不再保留。

---

## 二、重构原则

1. **完全重构，不保留兼容层**：`phase-f`/`phase-h` 别名、旧 `negotiation`（等同于 VotingRound 的语义误用）、直接提交写操作的 client 方法——全部删除。
2. **所有写操作走 ActionIntent**：`POST /action-intents` 是唯一写入路径。
3. **成熟库优先**：继续使用 commander/zod/better-sqlite3/eventsource-parser/execa/pino/vitest。不引入新 HTTP 框架，不引入复杂调度库。
4. **模块化复用**：新增命令/store/handler 遵循现有模式，不重复造轮子。
5. **只改 vibly-client**：不修改 coordinator 路由，不修改 concord 包。

---

## 三、实施阶段

### Phase 0：清理 + ActionIntent 基础（先决条件）

**目标**：建立 ActionIntent 提交基础，清除废弃代码。

#### 0.1 删除废弃内容

- 删除 `src/cli/commands/dev/phase-aliases.ts`
- 从 `src/cli/commands/index.ts` 移除 `registerPhaseAliasCommands` 注册
- 删除 `CoordinatorClient` 中直接调用写操作的方法（`claimWorkOrder`、`submitWorkOrder`、`submitNegotiationPosition`、`closeNegotiation`、`requestReview`、`submitReview`、`aggregateReviews`、`claimReward`、`submitGovernanceOpenGov`、`submitGovernanceVoteOpenGov`）

  > **注意**：这些方法在对应 CLI 命令中被调用，所有调用处必须在 Phase 1 中同步替换为 ActionIntent 路径。

#### 0.2 ActionIntent client 方法

在 `src/coordinator/client.ts` 增加：

```ts
async submitActionIntent(intent: ActionIntentInput): Promise<ActionIntentReceipt>
async listActionIntents(query?: { actorId?: string; type?: string; status?: string; limit?: number }): Promise<{ items: ActionIntentReceipt[] }>
async getActionIntent(id: string): Promise<ActionIntentReceipt>
```

使用 `POST /action-intents`（已在 coordinator routes 中声明 `actionsRoutes`，但需确认 contract 类型）。

#### 0.3 ActionIntent zod schema

新建 `src/schemas/actionIntent.ts`：

```ts
// ActionIntent types 对应 DDD UL §3.9
export const ActionIntentTypeSchema = z.enum([
  "CreateObservation",
  "RespondAssignmentOffer",
  "SubmitObservationResult",
  "StartDiscussion",
  "AddComment",
  "CloseDiscussionWithOutcome",
  "SubmitDiscussionContribution",
  "SubmitProposal",
  "SubmitReview",
  "CreateVotingRound",
  "SubmitVote",
  "ClaimTask",
  "SubmitArtifact",
  "VetoProposal",
  "AnswerRequest",
]);

export const ActionIntentInputSchema = z.object({
  type: ActionIntentTypeSchema,
  actorId: z.string(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  payload: z.record(z.unknown()),
  idempotencyKey: z.string().uuid().optional(),
});
```

#### 0.4 domain types 更新

在 `src/domain/clientTypes.ts` 新增 v0.2 概念类型：

```ts
// 新增
export interface ActionIntentInput { type: string; actorId: string; organizationId?: string; projectId?: string; payload: Record<string, unknown>; }
export interface ActionIntentReceipt { id: string; type: string; status: "pending"|"accepted"|"rejected"; createdAt: string; }
export interface OrganizationSnapshot { id: string; name: string; status: string; handbook?: unknown; members: unknown[]; }
export interface ProjectHandbookSnapshot { projectId: string; content: unknown; updatedAt: string; }
export interface MechanismSnapshot { id: string; organizationId: string; name: string; updatedAt: string; }
export interface QueueItem<T> { id: string; kind: string; status: string; payload: T; assignedAt?: string; deadline?: string; }
```

**验收**：`pnpm lint` 通过（不新增编译错误）。

---

### Phase 1：v0.2 Read Model Sync（核心数据层）

**目标**：本地能缓存并查询所有 v0.2 对象的 snapshot。

#### 1.1 本地 Store 新增

新增以下文件（仿照 `localEntityStore.ts` 模式，强类型化）：

| 文件 | 用途 |
|------|------|
| `src/local/stores/localOrganizationStore.ts` | 缓存 OrganizationSnapshot |
| `src/local/stores/localHandbookStore.ts` | 缓存 ProjectHandbook/OrgHandbook |
| `src/local/stores/localMechanismStore.ts` | 缓存 MechanismRegistry snapshot |
| `src/local/stores/localQueueStore.ts` | 统一存储各类 queue item（按 kind 区分） |

`localQueueStore.ts` 关键接口：

```ts
class LocalQueueStore {
  upsertItem(kind: QueueKind, item: QueueItem<unknown>): void
  listItems(kind: QueueKind, opts?: { status?: string; limit?: number }): QueueItem<unknown>[]
  markHandled(kind: QueueKind, id: string, status: "handled"|"skipped"): void
}

type QueueKind = "obligation" | "observation" | "discussion" | "task" | "review" | "vote"
```

#### 1.2 DB Migration

在 `src/local/migrations.ts` 增加对应表：

```sql
-- organizations
CREATE TABLE IF NOT EXISTS local_organizations (
  id TEXT PRIMARY KEY, data_json TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- handbooks
CREATE TABLE IF NOT EXISTS local_handbooks (
  scope TEXT NOT NULL, scope_id TEXT NOT NULL, data_json TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (scope, scope_id)
);
-- mechanisms
CREATE TABLE IF NOT EXISTS local_mechanisms (
  id TEXT PRIMARY KEY, organization_id TEXT, data_json TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- queue items
CREATE TABLE IF NOT EXISTS local_queue_items (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL,
  payload_json TEXT NOT NULL, assigned_at TEXT, deadline TEXT, updated_at TEXT NOT NULL
);
```

#### 1.3 CoordinatorClient 新增读方法

在 `src/coordinator/client.ts` 新增（对应 coordinator 已有路由）：

```ts
// Organizations
async listOrganizations(q?: { limit?: number }): Promise<{ items: OrganizationSnapshot[] }>
async getOrganization(id: string): Promise<OrganizationSnapshot>

// Handbooks (调用 coordinator 已有 /projects/:id/boundary 类似路由，或新路由上线后对接)
async getProjectHandbook(projectId: string): Promise<ProjectHandbookSnapshot | null>
async getOrgHandbook(orgId: string): Promise<unknown | null>

// Mechanisms
async listMechanisms(q?: { organizationId?: string; projectId?: string; limit?: number }): Promise<{ items: MechanismSnapshot[] }>

// Queues (observation/discussion/task/review/voting assignments for current agent)
async listObservationAssignments(q?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }>
async listDiscussionParticipations(q?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }>
async listAvailableTasks(q?: { projectId?: string; limit?: number }): Promise<{ items: unknown[] }>
async listAssignedTasks(q?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }>
async listReviewAssignments(q?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }>
async listVotingAssignments(q?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }>
async listObligations(q?: { agentId?: string; status?: string; limit?: number }): Promise<{ items: unknown[] }>
```

> **约束**：所有方法必须通过 `this.contract.GET(path(...))` 调用，不能手写 URL。若 coordinator 路由尚未实现，方法返回空列表并记录 warn，等待路由上线后填充。

#### 1.4 sync 命令扩展

扩展 `src/cli/commands/observability/sync.ts`：

```
vibly sync                   # 同步所有（organizations+projects+handbooks+mechanisms+queues+events）
vibly sync organizations     # 同步 organization snapshots
vibly sync handbook --project <id>  # 同步 project handbook
vibly sync mechanisms        # 同步 mechanism registry
vibly sync queues            # 同步所有队列
```

#### 1.5 新增 organization/handbook/mechanisms CLI 命令

新建文件：

- `src/cli/commands/workflow/organization.ts` → `vibly organizations list/show/inspect`
- `src/cli/commands/workflow/handbook.ts` → `vibly handbook show --project/--org`
- `src/cli/commands/workflow/mechanisms.ts` → `vibly mechanisms list/show`

注册到 `src/cli/commands/index.ts`。

**验收**：
- `vibly sync` 能拉取并持久化 organization/handbook/mechanism/queue snapshot。
- `vibly organizations list` 能展示本地缓存。
- `pnpm lint` + `pnpm test` 通过。

---

### Phase 2：队列命令 + ActionIntent 写操作（CLI 完整化）

**目标**：CLI 命令覆盖 v0.2 所有队列操作，写操作全部走 ActionIntent。

#### 2.1 queue 命令

新建 `src/cli/commands/workflow/queue.ts`：

```
vibly queue obligations              # 查看义务队列
vibly queue observations             # 查看观察任务队列
vibly queue discussions              # 查看讨论参与队列
vibly queue tasks                    # 查看任务队列（可领取）
vibly queue reviews                  # 查看评审队列
vibly queue votes                    # 查看投票队列
```

默认读本地缓存，`--live` 参数拉取最新。

#### 2.2 observation 命令

新建 `src/cli/commands/workflow/observation.ts`：

```
vibly observation accept <assignmentOfferId>
vibly observation submit <observationTaskId> --file result.json
```

实现：调用 `client.submitActionIntent({ type: "RespondAssignmentOffer", ... })` 和 `{ type: "SubmitObservationResult", ... }`。

#### 2.3 discussion 命令

新建 `src/cli/commands/workflow/discussion.ts`：

```
vibly discussion contribute <discussionRoundId> --file contribution.md
```

实现：`{ type: "SubmitDiscussionContribution", ... }`。

#### 2.4 proposal 命令

新建 `src/cli/commands/workflow/proposal.ts`：

```
vibly proposal submit --project <id> --file proposal.md
```

实现：`{ type: "SubmitProposal", ... }`。

#### 2.5 task 命令（替换旧 work 命令）

**删除** `src/cli/commands/workflow/work.ts`（旧 WorkOrder 语义）。  
新建 `src/cli/commands/workflow/task.ts`：

```
vibly task list              # 查看可领取任务（本地缓存）
vibly task claim <taskId>    # 领取任务 → ActionIntent ClaimTask
vibly task run <taskId> --runtime <name>  # 本地执行
vibly task submit <taskId> --artifact <path>  # 提交 → ActionIntent SubmitArtifact
```

#### 2.6 review 命令更新

更新 `src/cli/commands/workflow/review.ts`：

```
vibly review list            # 列出评审队列
vibly review submit <reviewRoundId> --file review.json
```

实现：`{ type: "SubmitReview", ... }`（不再直接 POST /reviews）。

#### 2.7 voting 命令（替换旧 vote 命令）

**删除** `src/cli/commands/governance/vote.ts`。  
**更新** `src/cli/commands/governance/negotiation.ts` 或新建 `src/cli/commands/governance/voting.ts`：

```
vibly vote list              # 查看投票队列
vibly vote submit <votingRoundId> --choice support|oppose|abstain
```

实现：`{ type: "SubmitVote", ... }`。

#### 2.8 client 写方法清理

确认 Phase 0 中标记删除的直接写方法均已替换完毕。`CoordinatorClient` 只保留：
- 所有 GET 方法（read model 查询）
- `submitActionIntent` / `listActionIntents` / `getActionIntent`

#### 2.9 schema 新增

```
src/schemas/actionIntent.ts     # Phase 0 已建，在此完善所有 payload schema
src/schemas/observation.ts      # ObservationResultSchema
src/schemas/discussion.ts       # DiscussionContributionSchema
src/schemas/proposal.ts         # ProposalSchema
src/schemas/task.ts             # ClaimTaskSchema, SubmitArtifactSchema
src/schemas/voting.ts           # SubmitVoteSchema (替换旧 vote.ts)
```

**验收**：
- `vibly queue tasks` / `vibly task claim` / `vibly task submit` 端到端可用。
- `vibly vote submit` 使用 ActionIntent。
- `pnpm lint` + `pnpm test` 通过。
- `scripts/check-handwritten-paths.mjs` 通过（无新增手写 path）。

---

### Phase 3：Daemon Loop 升级 + Runtime 输出标准化

**目标**：daemon 按 v0.2 队列拆分 handler，统一 RuntimeOutput 格式。

#### 3.1 RuntimeInput / RuntimeOutput 标准化

更新 `src/domain/clientTypes.ts`：

```ts
// 统一 RuntimeInput（替换旧 RuntimeExecutionInput）
export interface RuntimeInput {
  agentId: string;
  runtimeBindingId: string;
  assignmentId: string;       // observationTaskId / discussionRoundId / taskId / reviewRoundId / votingRoundId
  assignmentKind: "observation" | "discussion" | "task" | "review" | "vote";
  organization?: OrganizationSnapshot;
  project?: unknown;
  handbook?: ProjectHandbookSnapshot;
  mechanism?: MechanismSnapshot;
  payload: unknown;           // assignment-specific data
  contextBundle?: unknown;
  knowledgeSnapshot?: unknown;
  workingDirectory: string;
}

// 统一 RuntimeOutput（替换旧 AdapterResult + RuntimeHostResult）
export interface RuntimeOutput {
  status: "success" | "failed" | "partial";
  summary: string;
  artifact?: { uri: string; hash?: string; mediaType?: string };
  structuredResult?: unknown;  // observation result / vote / review
  contribution?: string;       // discussion markdown
  executionReceipt: ExecutionReceiptData;
  logs?: string;
}
```

更新 `src/runtime/runtimeHost.ts` 接受 `RuntimeInput`，返回 `RuntimeOutput`。  
更新三个 adapter (`scriptRuntime`, `mockRuntime`, `humanAssistedRuntime`) 对齐新 interface。

#### 3.2 Daemon Handlers 重构

新建/替换以下 handlers：

| Handler | 触发条件 | 执行内容 |
|---------|---------|---------|
| `protocolHandler.ts` | 每次 loop 起始 | 拉取 ClientProtocolSnapshot，检查版本；不兼容时停止 loop 并告警 |
| `syncHandler.ts` | 每次 loop | 同步 org/project/handbook/mechanism + 各类 queue（已有，扩展） |
| `observationAssignmentHandler.ts` | queue 中有待处理 observation | 调用 RuntimeHost → 生成 ObservationResult → 提交 ActionIntent SubmitObservationResult |
| `discussionParticipationHandler.ts` | queue 中有待处理 discussion | 调用 RuntimeHost → 生成 contribution → 提交 ActionIntent SubmitDiscussionContribution |
| `taskHandler.ts` | queue 中有 available task + autoClaim | 自动 ClaimTask → 执行 → SubmitArtifact（替换旧 workHandler） |
| `reviewHandler.ts` | queue 中有待评审 | 调用 RuntimeHost → 生成 review → 提交 ActionIntent SubmitReview（已有，更新语义） |
| `votingHandler.ts` | queue 中有待投票 | 按策略自动 SubmitVote（已有，更新语义） |
| `rewardHandler.ts` | 保持现有逻辑 | 查看 claimable rewards（read-only，不执行 claim） |

**删除**：`workHandler.ts`（替换为 `taskHandler.ts`）、`negotiationHandler.ts`（negotiation 语义已变）。

#### 3.3 Daemon Loop 更新

更新 `src/daemon/loop.ts`：

```ts
export async function runLoop(client, profile, config): Promise<void> {
  await protocolHandler(client, profile);      // 版本检查
  await syncHandler(client, profile);           // 全量 sync
  await observationAssignmentHandler(client, profile, config);
  await discussionParticipationHandler(client, profile, config);
  await taskHandler(client, profile, config);   // 替换 workHandler
  await reviewHandler(client, profile, config);
  await votingHandler(client, profile, config);
  await rewardHandler(client, profile, config);
}
```

#### 3.4 DaemonConfig schema 更新

更新 `src/schemas/daemon.ts`，新增：

```ts
autoHandleObservations: z.boolean().default(false),
autoHandleDiscussions: z.boolean().default(false),
autoVoteRules 已有，保留
```

**验收**：
- `vibly daemon once --verbose` 能跑通一次 loop，打印各 handler 日志。
- RuntimeOutput 统一格式。

---

### Phase 4：奖励和声誉展示

**目标**：展示 RewardIntent、声誉事件、ReviewReliability。

#### 4.1 rewards 命令扩展

扩展 `src/cli/commands/workflow/rewards.ts`：

```
vibly rewards list           # 已有
vibly rewards show <id>      # 已有
vibly rewards reputation     # 展示 agent 声誉 (GET /agents/:id/reputation 或从 events 聚合)
vibly rewards settlement     # 展示 SettlementBatch（如 coordinator 已有）
```

`rewards claim` **不**调用直接 API，改为提交 ActionIntent（如果 coordinator 支持）。或保留为 read-only，仅展示 claimable 状态。

#### 4.2 reputation 命令

新建 `src/cli/commands/identity/reputation.ts`（可选，如 coordinator 有路由）：

```
vibly reputation show        # 展示当前 agent 声誉分数和历史
```

#### 4.3 rewards schema

新建 `src/schemas/reward.ts`：

```ts
export const ClaimRewardIntentSchema = z.object({ rewardIntentId: z.string() });
```

**验收**：`vibly rewards list` 展示 status/amount/recipient。

---

## 四、删除清单

完成所有 Phase 后，以下内容应完全删除：

| 删除内容 | 原因 |
|---------|------|
| `src/cli/commands/dev/phase-aliases.ts` | 废弃 phase-f/phase-h 别名 |
| `src/cli/commands/governance/vote.ts` | 替换为 voting.ts（ActionIntent） |
| `src/cli/commands/workflow/work.ts` | 替换为 task.ts（ActionIntent + v0.2 语义） |
| `src/daemon/handlers/workHandler.ts` | 替换为 taskHandler.ts |
| `src/daemon/handlers/negotiationHandler.ts` | negotiation 语义已变，无法直接复用 |
| CoordinatorClient 中的写方法（见 Phase 0.1） | 所有写操作改走 ActionIntent |

---

## 五、不改动内容

以下内容**保持不变**或只做最小兼容调整：

| 保持不变 | 原因 |
|---------|------|
| `src/coordinator/contractClient.ts` | transport/retry 层，无需改动 |
| `src/coordinator/sse.ts` | SSE 解析，无需改动 |
| `src/coordinator/contractPaths.ts` | 已有路径，新增时在此扩展 |
| `src/local/database.ts` | 数据库初始化，稳定 |
| `src/local/migrations.ts` | 新增迁移，不修改旧迁移 |
| `src/local/stores/localEntityStore.ts` | 通用 KV store，继续使用 |
| `src/local/stores/localEventStore.ts` | 事件存储，继续使用 |
| `src/local/stores/localSyncStateStore.ts` | 游标状态，继续使用 |
| `src/local/stores/localRuntimeStore.ts` | runtime 注册表，继续使用 |
| `src/runtime/adapters/` | 三个 adapter 只更新 interface，不重写逻辑 |
| `src/cli/commands/core/` | config/login/status，保持不变 |
| `src/cli/commands/identity/agent.ts` | 注册/查看，保持不变 |
| `src/cli/commands/identity/principal.ts` | 注册/查看，保持不变 |
| `src/cli/commands/identity/runtime.ts` | 本地 runtime 管理，保持不变 |
| `src/cli/commands/observability/events.ts` | 事件流，保持不变 |
| `src/cli/commands/observability/trace.ts` | trace，保持不变 |
| `src/cli/commands/governance/governance.ts` | 链上 OpenGov，保持不变 |
| `src/cli/commands/workflow/context.ts` | context bundle，保持不变 |
| `src/cli/commands/workflow/knowledge.ts` | 知识版本，保持不变 |
| `src/cli/commands/workflow/project.ts` | project CRUD，保持不变 |
| `src/cli/commands/dev/scenarios.ts` | dev scenarios，保持不变 |
| `src/chain/` | chain adapter，不在本次范围 |

---

## 六、新增文件总览

```
src/
  schemas/
    actionIntent.ts           # ActionIntent 类型和 payload schemas
    observation.ts            # ObservationResultSchema
    discussion.ts             # DiscussionContributionSchema
    proposal.ts               # ProposalSchema
    task.ts                   # ClaimTaskSchema, SubmitArtifactSchema
    voting.ts                 # SubmitVoteSchema (替换 vote.ts)
    reward.ts                 # ClaimRewardIntentSchema

  local/stores/
    localOrganizationStore.ts
    localHandbookStore.ts
    localMechanismStore.ts
    localQueueStore.ts

  cli/commands/workflow/
    organization.ts           # vibly organizations ...
    handbook.ts               # vibly handbook ...
    mechanisms.ts             # vibly mechanisms ...
    queue.ts                  # vibly queue ...
    observation.ts            # vibly observation ...
    discussion.ts             # vibly discussion ...
    proposal.ts               # vibly proposal ...
    task.ts                   # vibly task ... (替换 work.ts)

  cli/commands/governance/
    voting.ts                 # vibly vote submit (ActionIntent, 替换旧 vote.ts)

  cli/commands/identity/
    reputation.ts             # vibly reputation ... (可选，依赖 coordinator 路由)

  daemon/handlers/
    protocolHandler.ts        # 版本检查
    observationAssignmentHandler.ts
    discussionParticipationHandler.ts
    taskHandler.ts            # 替换 workHandler.ts
    # reviewHandler.ts 已有，更新语义
    # votingHandler.ts 已有，更新语义
```

---

## 七、依赖变更

**不新增依赖**。继续使用：

```json
{
  "commander": "^12.1.0",
  "zod": "^3.23.8",
  "better-sqlite3": "^9.6.0",
  "eventsource-parser": "^3.0.0",
  "execa": "^9.3.0",
  "pino": "^9.3.2",
  "@vibly/coordinator-http-contract": "workspace:*"
}
```

---

## 八、验收标准

与重构文档 §12 对齐：

1. `pnpm lint` 通过（`tsc --noEmit` + `check-handwritten-paths.mjs`）。
2. `pnpm test` 通过。
3. 所有写命令最终提交 `ActionIntent`（`vibly task claim/submit`、`vibly vote submit`、`vibly observation submit` 等）。
4. daemon 能跑通：`sync queues → pick task → RuntimeHost → submit ActionIntent → update sync cursor`。
5. 本地 cache 能持久化 organization/handbook/mechanism/queue snapshot。
6. client 不含 OpenGov 主路径逻辑（仅 `governance.ts` 包含链上命令，保持现状）。
7. 不新增手写 HTTP path 常量。

---

## 九、实施顺序建议

```
Phase 0 (约 0.5d)
  └─ 清理废弃代码 + 建立 ActionIntent 基础

Phase 1 (约 1d)
  ├─ 新增 4 个本地 store + DB migration
  ├─ 新增 coordinator read 方法
  └─ 新增 sync/organization/handbook/mechanisms CLI

Phase 2 (约 1d)
  ├─ 新增 queue/observation/discussion/proposal/task CLI
  ├─ 更新 review/vote CLI 走 ActionIntent
  └─ 清理旧 work.ts/vote.ts

Phase 3 (约 0.5d)
  ├─ 标准化 RuntimeInput/RuntimeOutput
  ├─ 重构 daemon handlers
  └─ 更新 daemon loop

Phase 4 (约 0.5d)
  └─ 奖励和声誉展示扩展
```

**总计估时：约 3-4 天（视 coordinator 路由就绪情况）**

> **阻塞项**：Phase 1/2 中 organization/handbook/mechanism/queue 路由需要 coordinator 已实现对应端点。若路由未就绪，client 方法返回空列表并记录 `warn`，等待 coordinator 更新后填充。
