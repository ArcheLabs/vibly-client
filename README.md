# vibly-client

vibly-client 是 Vibly 协调网络的 CLI 和后台 daemon。分两类命令：

- **协调层命令**（大多数命令）：通过 HTTP 与 `vibly-coordinator` 交互，管理项目、工作单、协商、评审等协议流程。
- **治理命令**（`vibly governance`）：读路径可通过 coordinator 查询统一 merged view；Substrate OpenGov 写路径仍直接通过 polkadot-api (PAPI) 与 vibly-chain solo-node 交互，或查询 vibly-indexer SubQuery GraphQL endpoint。

## 安装

```bash
pnpm install
pnpm build
# 可选：全局链接
npm link
```

## 快速开始

```bash
# 1. 连接 coordinator
vibly login --coordinator http://localhost:8787 --token dev-token

# 2. 注册委托人
vibly principal register --kind human --name "My Principal"

# 3. 注册 Agent
vibly agent register --name "My Agent" --capabilities "research,analysis"

# 4. 注册本地脚本运行时
vibly runtime register-script --name my-runtime --command "node scripts/my-agent.js"

# 5. 选择项目
vibly project use <project-id>

# 6. 同步本地状态
vibly sync all

# 7. 启动 daemon（自动处理工作单）
vibly daemon start
```

## CLI 命令

### 认证 & 配置

| 命令 | 说明 |
|---|---|
| `vibly login` | 认证并保存 profile |
| `vibly logout [profile]` | 删除已保存的 profile |
| `vibly config show` | 显示当前配置 |
| `vibly config set-profile <name>` | 切换活跃 profile |
| `vibly status` | 显示活跃 profile 详情 |

### 委托人 & Agent

| 命令 | 说明 |
|---|---|
| `vibly principal register/show/list/bind-address` | 委托人管理 |
| `vibly agent register/show/availability/bind-runtime` | Agent 管理 |
| `vibly runtime list/register-script/show/delete` | 本地运行时管理 |

### 工作流程

| 命令 | 说明 |
|---|---|
| `vibly work list/show/claim/run/submit/execute` | 工作单操作（execute = claim+run+submit）|
| `vibly context get/accept` | 上下文 bundle 管理 |
| `vibly review list/show/submit/aggregate` | 评审管理 |
| `vibly rewards list/show/claim` | 奖励管理 |

### 协商 & 投票

| 命令 | 说明 |
|---|---|
| `vibly negotiation list/show/position/close` | 协商管理 |
| `vibly vote submit` | 提交协商投票（协议层，非链上治理投票）|

### 知识 & 事件

| 命令 | 说明 |
|---|---|
| `vibly knowledge show/list` | 查看知识版本 |
| `vibly events list/stream` | 查看和流式订阅事件 |
| `vibly trace list/show/verify/replay` | 追踪管理 |
| `vibly scenarios agent-collaboration run/runs` | 运行或查看 Agent 协作 dev 场景（旧别名 `phase-f smoke/runs`）|
| `vibly scenarios incentive-risk run/runs/status` | 运行或查看激励/风险 dev 场景（旧别名 `phase-h smoke/runs/status`）|

### 同步 & Daemon

| 命令 | 说明 |
|---|---|
| `vibly sync events/work/project/all` | 同步本地状态 |
| `vibly daemon start/once/status` | 后台 daemon |

### 治理（`vibly governance`）

Coordinator 读路径：

| 命令 | 说明 |
|---|---|
| `vibly governance merged [--backend evm-governor]` | 从 coordinator 读取统一 merged governance view |
| `vibly governance subjects [--backend evm-governor]` | 从 coordinator 读取 typed governance subjects |
| `vibly governance checkpoint [--backend evm-governor]` | 查看 coordinator 的 governance index checkpoint |
| `vibly governance backends` | 查看已注册 governance backend descriptors、capabilities 与 health/freshness |
| `vibly governance submit-opengov <intentId> --actor <account>` | Phase E 主路径：通过 coordinator 提交治理 intent |
| `vibly governance reconcile <intentId> --external-id <referendumIndex>` | 将 intent 与 indexer 回读的 OpenGov subject 关联 |
| `vibly governance vote-opengov <subjectId> --voter <account> --stance aye` | 通过 coordinator 提交 OpenGov vote 并等待 readback |

Phase D.5 demo 验证建议：

```bash
vibly governance backends
vibly governance merged --backend evm-governor
vibly governance subjects --backend substrate-opengov
vibly governance checkpoint --backend evm-governor
```

Phase E OpenGov 闭环验证建议：

```bash
vibly governance submit-opengov <intentId> --actor <account>
vibly governance reconcile <intentId> --external-id <referendumIndex>
vibly governance vote-opengov <subjectId> --voter <account> --stance aye --weight 2000000000
vibly governance merged --backend substrate-opengov
```

### Agent 协作 dev 场景

Coordinator 需启用 `ENABLE_DEV_ROUTES=true`。Client 验证：

```bash
vibly scenarios agent-collaboration run
vibly scenarios agent-collaboration runs
vibly trace verify trace_phase_f_smoke
vibly trace replay trace_phase_f_smoke
```

`scenarios agent-collaboration run` 会触发 coordinator 的 dev-only scripted loop：Observer 观察并提出 high-risk action，Delegate/Guardian 协商，Worker 执行，Reviewer 评审，随后生成可验证和重放的 trace。

> 旧命令 `vibly phase-f smoke|runs` 仍作为 deprecated alias 保留，方便已有脚本兼容；新用法请使用 `scenarios`。

### 激励 / 风险 dev 场景

Coordinator 需启用 `ENABLE_DEV_ROUTES=true`。Client 验证：

```bash
vibly scenarios incentive-risk run
vibly scenarios incentive-risk runs
vibly scenarios incentive-risk status --project-id project_phase-f-collaboration
```

`scenarios incentive-risk run` 会在 agent-collaboration accepted work 基础上生成 reward intent、mock ledger funding receipt、claimable reward、reputation evidence、slash request 与 Guardian-visible risk 记录。该场景默认使用 mock ledger；真实 Vibly chain settlement 留给后续阶段。

> 旧命令 `vibly phase-h smoke|runs|status` 仍作为 deprecated alias 保留，方便已有脚本兼容；新用法请使用 `scenarios`。

Substrate OpenGov 直链/直 indexer 路径：

| 命令 | 说明 |
|---|---|
| `vibly governance list` | 从 SubQuery indexer 列出公投（open referenda）|
| `vibly governance show <referendumIndex>` | 查看单个公投详情 |
| `vibly governance vote <referendumIndex>` | 链上投票（需 `papi add vibly-solo` codegen）|
| `vibly governance delegate <delegatee>` | 委托 conviction 投票权 |
| `vibly governance undelegate` | 撤销委托 |
| `vibly governance unlock [referendumIndex]` | 解锁/取回余额 |

> **注意**：`vibly governance vote/delegate/undelegate/unlock` 需要先运行 PAPI codegen：
> ```bash
> pnpm dlx @polkadot-api/cli add vibly-solo --wsUrl ws://127.0.0.1:9944
> ```

## 链上治理环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VIBLY_CHAIN_RPC_URL` | `ws://127.0.0.1:9944` | vibly-chain solo-node WebSocket 端点 |
| `VIBLY_CHAIN_SIGNER_URI` | `//Alice` | 签名账号（dev URI 或 hex 私钥）|
| `VIBLY_CHAIN_ID` | `substrate:vibly-solo` | 链标识符 |
| `VIBLY_INDEXER_URL` | `http://localhost:3010/graphql` | SubQuery GraphQL 端点 |

## Coordinator 环境变量

| 变量 | 说明 |
|---|---|
| `VIBLY_API_TOKEN` | 默认 API token |
| `VIBLY_CONFIG_PATH` | 覆盖配置文件路径 |
| `VIBLY_DB_PATH` | 覆盖本地数据库路径 |

## 自定义脚本运行时

参考 `examples/runtimes/research-agent.js`，脚本通过以下环境变量接收输入：

| 环境变量 | 说明 |
|---|---|
| `VIBLY_WORK_ORDER_JSON` | 完整工作单 JSON |
| `VIBLY_CONTEXT_BUNDLE_JSON` | 上下文 bundle JSON |
| `VIBLY_OUTPUT_DIR` | 输出文件目录 |
| `VIBLY_WORK_DIR` | 临时工作目录 |

在输出目录写入 `result.json`（含 `{ "summary": "..." }`）。

## Daemon 配置

在 `~/.vibly/config.json` 的 profile 中设置：

```json
{
  "profiles": {
    "default": {
      "daemon": {
        "autoClaim": true,
        "autoRun": true,
        "autoSubmit": true,
        "autoVote": false,
        "autoClaimRewards": false
      }
    }
  }
}
```

## 开发

```bash
pnpm build      # 编译 TypeScript
pnpm test       # 运行单元测试
pnpm lint       # Lint
```
