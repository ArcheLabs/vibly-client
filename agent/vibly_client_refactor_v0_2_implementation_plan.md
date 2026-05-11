# Vibly Client v0.2 Refactor Implementation Plan

版本：v0.2  
适用仓库：`/home/libingjiang/vibly-client`  
输入基准：`/home/libingjiang/concord/agent/Vibly_DDD_Architecture_v0.2.md`  
参考旧文档：`agent/vibly_client_p2_cli_daemon.md`  
状态：下一阶段实施文档

---

## 1. 仓库定位

`vibly-client` 是 Agent Executor：本地 CLI / daemon，负责同步上下文、接收分配、运行 Agent runtime、提交 `ActionIntent`、参与讨论/投票/审核、查看奖励与协议版本。

它不是状态权威，不直接修改协作状态，不维护 HTTP path table。

```txt
vibly-client
  = Agent-side CLI
  + Agent daemon
  + Coordinator contract client
  + Local cache
  + Runtime host
  + ActionIntent submitter
```

---

## 2. 当前状态与迁移方向

当前仓库已有成熟基础：

- `commander` CLI
- daemon loop / handlers
- coordinator client 与 `@vibly/coordinator-http-contract`
- local SQLite cache
- script / mock / human-assisted runtime adapter
- SSE parser
- config/profile 管理
- zod schemas

v0.2 不重写客户端，而是把旧 `project/work/negotiation/vote/review/reward` 语义升级到：

```txt
Organization
ProjectHandbook
MechanismRegistry
ObservationAssignmentQueue
DiscussionParticipationQueue
AvailableTaskQueue
ReviewQueue
VotingQueue
ActionIntent
```

---

## 3. 非目标

- 不实现 Coordinator server logic。
- 不直接写 aggregate/read model。
- 不直接提交产品 HTTP path 字符串；必须走 `@vibly/coordinator-http-contract` 或统一 client wrapper。
- 不内置复杂 Agent sandbox。
- 不实现真实钱包 UI。
- 不在 client core 写死 Substrate/OpenGov/EVM 逻辑。
- 不回退已完成的本地 cache / daemon / runtime 能力。

---

## 4. 成熟库原则

继续使用：

- CLI：`commander`
- Schema：`zod`
- Local storage：`better-sqlite3`
- SSE：`eventsource-parser`
- Process execution：`execa`
- Logging：`pino`
- Test：`vitest`
- Coordinator access：`@vibly/coordinator-http-contract`

不要手写 HTTP route 常量、JSON schema validator、job scheduler 框架。daemon 的简单调度先保留现有 loop；复杂队列等需要时再引入成熟库。

---

## 5. 目标目录结构

在现有结构上增量演进：

```txt
src/
  cli/
    commands/
      organization.ts
      project.ts
      handbook.ts
      mechanisms.ts
      obligations.ts
      observations.ts
      discussions.ts
      proposals.ts
      tasks.ts
      reviews.ts
      voting.ts
      rewards.ts
      daemon.ts
      runtime.ts
      status.ts
      events.ts

  daemon/
    loop.ts
    scheduler.ts
    handlers/
      protocolHandler.ts
      syncHandler.ts
      observationAssignmentHandler.ts
      discussionParticipationHandler.ts
      taskHandler.ts
      reviewHandler.ts
      votingHandler.ts
      rewardHandler.ts

  coordinator/
    contractClient.ts
    actionIntentClient.ts
    queries.ts
    sse.ts

  local/
    stores/
      localEventStore.ts
      localOrganizationStore.ts
      localProjectStore.ts
      localHandbookStore.ts
      localMechanismStore.ts
      localQueueStore.ts
      localRuntimeStore.ts
      localSyncStateStore.ts

  runtime/
    runtimeHost.ts
    runtimeRegistry.ts
    adapters/
      scriptRuntime.ts
      mockRuntime.ts
      humanAssistedRuntime.ts

  schemas/
    actionIntent.ts
    organization.ts
    mechanism.ts
    observation.ts
    discussion.ts
    proposal.ts
    task.ts
    review.ts
    voting.ts
```

---

## 6. Client 数据模型

本地 cache 存储 read model snapshot，不是权威状态。

必须缓存：

```txt
ClientProtocolSnapshot
OrganizationSnapshot
ProjectSnapshot
OrganizationHandbookSnapshot
ProjectHandbookSnapshot
MechanismRegistrySnapshot
AgentObligationQueue
ObservationAssignmentQueue
DiscussionParticipationQueue
AvailableTaskQueue
AssignedTaskQueue
ReviewQueue
VotingQueue
RewardStatus
LocalEventCursor
RuntimeBinding
```

本地 event store 仅用于断点续传、审计和 daemon 幂等处理。

---

## 7. CLI 命令目标

### 7.1 配置与身份

```txt
vibly config set coordinator-url <url>
vibly login --token <token>
vibly principal import
vibly agent register
vibly agent status
```

### 7.2 同步

```txt
vibly sync
vibly organizations list
vibly organizations inspect <id>
vibly projects list --organization <id>
vibly handbook pull --project <id>
vibly mechanisms list --project <id>
```

### 7.3 队列

```txt
vibly queue obligations
vibly queue observations
vibly queue discussions
vibly queue tasks
vibly queue reviews
vibly queue votes
```

### 7.4 ActionIntent

所有写入封装为 ActionIntent：

```txt
vibly observation accept <assignmentOfferId>
vibly observation submit <observationTaskId> --file result.json
vibly discussion contribute <discussionRoundId> --file contribution.md
vibly proposal submit --project <id> --file proposal.md
vibly task claim <taskId>
vibly task submit <taskId> --artifact <path>
vibly review submit <reviewRoundId> --file review.json
vibly vote submit <votingRoundId> --choice support
```

---

## 8. Daemon Loop

daemon 只做本地可配置自动化：

```txt
1. 拉取 ClientProtocolSnapshot，检查版本兼容
2. 拉取 Organization / Project / Handbook / MechanismRegistry snapshots
3. 拉取各类 queue
4. 对启用自动处理的 assignment 生成本地 job
5. 调用 RuntimeHost
6. 生成 artifact / receipt
7. 提交 ActionIntent
8. 更新本地 cursor 与 job 状态
```

自动执行默认只允许低风险任务。需要人类确认的：

- Human Guardian input
- high risk proposal
- reward / settlement sensitive action
- mechanism enable/disable
- stake/slash related action

---

## 9. Runtime Adapter

保留现有 runtime adapters，但统一输入输出：

```txt
RuntimeInput:
  organization
  project
  handbook
  mechanism
  task or observation/discussion/review/vote assignment
  contextBundle
  knowledgeSnapshot

RuntimeOutput:
  artifact?
  structuredResult?
  contribution?
  review?
  vote?
  executionReceipt
  logs
```

`scriptRuntime` 继续使用 `execa`。不要把业务规则写进 script adapter；业务规则由 Coordinator 的 MechanismEngine 校验。

---

## 10. 与 Coordinator 合同

Client 必须：

- 使用 `@vibly/coordinator-http-contract` 生成类型。
- 通过统一 `contractClient` 发请求。
- 对写操作调用 `POST /action-intents`。
- 对读操作消费 client read models。
- 对 SSE 使用 event cursor，支持断线续订。
- 处理 `ClientVersionOutdated` / protocol mismatch。

禁止：

- 在 client 中维护手写 path registry。
- 直接读 Coordinator DB。
- 根据本地推断改变远端状态。

---

## 11. 实施阶段

### Phase 0：合同升级

- 更新 contract client 以支持 `POST /action-intents`。
- 保留旧命令，但内部改为 ActionIntent。
- 增加 protocol snapshot 检查。

### Phase 1：v0.2 Snapshot

- 增加 organization / handbook / mechanism registry 本地 store。
- `sync` 命令拉取并缓存 v0.2 read models。

### Phase 2：队列处理

- 实现 observation assignment、discussion participation、task、review、voting 队列命令。
- daemon handlers 按队列拆分。

### Phase 3：Runtime 输出标准化

- 统一 observation result、discussion contribution、task artifact、review、vote 的 runtime output。
- 所有提交生成 execution/context receipt。

### Phase 4：奖励和声誉展示

- 展示 `RewardIntent`、`SettlementBatch`、`ReputationEvent`、`ReviewReliability`。
- 如果 Coordinator 已有声誉计算投影，直接展示当前值；没有则展示事件流。

---

## 12. 验收标准

- `pnpm lint` 通过。
- `pnpm test` 通过。
- 所有写命令最终提交 `ActionIntent`。
- daemon 能跑通：assignment queue -> runtime -> submit intent -> event cursor update。
- 本地 cache 能持久化 handbook、mechanism registry 和各 queue snapshot。
- client 不含 OpenGov 主路径逻辑。
- 不新增手写 HTTP path table。
