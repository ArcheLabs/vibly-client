# vibly-client

`vibly-client` 是 Vibly 协调网络的 **CLI 工具与后台守护进程**，提供两类命令：

- **协调命令**（绝大多数命令）— 通过 HTTP 与 `vibly-coordinator` 通信，管理项目、工作项、协商、审核及完整的协议生命周期。
- **链命令**（`vibly agent identity register-chain`、`vibly agent stake`、`vibly governance …`）— 通过 polkadot-api (PAPI) 直接与 `vibly-chain` 单节点交互，完成链上身份注册、代理质押和 OpenGov 交易。

所有协调器路径均通过 `@vibly/coordinator-http-contract` 进行类型约束，传输层适配器以外禁止硬编码路径字面量。

## 安装

```bash
pnpm install
pnpm build
# 可选：全局链接
npm link
```

## 快速开始

```bash
# 1. 连接协调器
vibly login --coordinator http://localhost:8787 --token dev-token

# 2. 注册委托人
vibly principal register --kind human --name "My Principal"

# 3. 注册代理
vibly agent register --name "My Agent" --capabilities "research,analysis"

# 4. 注册本地脚本运行时
vibly runtime register-script --name my-runtime --command "node scripts/my-agent.js"

# 5. 选择项目
vibly project use <project-id>

# 6. 同步本地状态
vibly sync all

# 7. 启动守护进程（自动处理工作项）
vibly daemon start
```

## CLI 参考

### 认证与配置

| 命令 | 说明 |
|---|---|
| `vibly login` | 认证并保存配置文件 |
| `vibly logout [profile]` | 删除已保存的配置文件 |
| `vibly config show` | 显示当前配置 |
| `vibly config set-profile <name>` | 切换活跃配置文件 |
| `vibly status` | 显示活跃配置文件详情 |

### 委托人与代理

| 命令 | 说明 |
|---|---|
| `vibly principal register/show/list/bind-address` | 委托人管理 |
| `vibly agent register/show/availability/bind-runtime` | 代理管理 |
| `vibly runtime list/register-script/show/delete` | 本地运行时管理 |

### 链上身份与质押

| 命令 | 说明 |
|---|---|
| `vibly agent identity register-chain` | 在链上注册根身份；返回 `identityId` |
| `vibly agent set-registrar --identity-id --registrar-key` | 为身份设置代理注册商 |
| `vibly agent register-chain --identity-id --agent-ref` | 在链上注册代理；返回 `agentId` |
| `vibly agent stake bond --identity-id --agent-id --amount` | 为代理绑定质押 |
| `vibly agent stake request-unbond --identity-id --agent-id --amount` | 申请解绑 |
| `vibly agent stake withdraw --identity-id --agent-id` | 提取已释放的质押 |

所有链命令均支持 `--rpc-url`、`--signer-uri`、`--chain-id` 和 `--json` 参数。

### 工作流

| 命令 | 说明 |
|---|---|
| `vibly work list/show/claim/run/submit/execute` | 工作项操作（`execute` = claim + run + submit） |
| `vibly context get/accept` | 上下文包管理 |
| `vibly review list/show/submit/aggregate` | 审核管理 |
| `vibly rewards list/show/claim` | 奖励管理 |

### 协商与投票

| 命令 | 说明 |
|---|---|
| `vibly negotiation list/show/position/close` | 协商管理 |
| `vibly vote submit` | 提交协议层协商投票 |

### 知识与事件

| 命令 | 说明 |
|---|---|
| `vibly knowledge show/list` | 查看知识版本 |
| `vibly events list/stream` | 列举并流式传输事件 |
| `vibly trace list/show/verify/replay` | 追踪管理 |

### 同步与守护进程

| 命令 | 说明 |
|---|---|
| `vibly sync events/work/project/all` | 同步本地状态 |
| `vibly daemon start/once/status` | 后台守护进程 |

### 治理

协调器读取路径：

| 命令 | 说明 |
|---|---|
| `vibly governance merged [--backend <name>]` | 从协调器读取统一合并的治理视图 |
| `vibly governance subjects [--backend <name>]` | 读取类型化的治理主题 |
| `vibly governance checkpoint [--backend <name>]` | 查看治理索引检查点 |
| `vibly governance backends` | 列举已注册的治理后端描述符、能力和新鲜度 |
| `vibly governance submit-opengov <intentId> --actor <account>` | 通过协调器提交治理意图 |
| `vibly governance reconcile <intentId> --external-id <referendumIndex>` | 将意图关联到链上主题 |
| `vibly governance vote-opengov <subjectId> --voter <account> --stance aye` | 提交 OpenGov 投票并等待索引器回读 |

## 守护进程

守护进程轮询分配给已注册代理的工作项，执行绑定的脚本运行时，并将结果提交回协调器。同时监听协调器 SSE 流以实时接收任务分配通知。

```bash
vibly daemon start [--interval 30000] [--once]
```

## 传输策略

- 所有协调器调用使用 Bearer token（`Authorization: Bearer <token>`）。
- GET 请求在网络错误时以指数退避重试。
- POST/PUT 请求包含 `Idempotency-Key` 请求头。
- 每次调用均强制执行可配置的请求超时。

## 开发

```bash
pnpm test          # Vitest 单元测试
pnpm typecheck     # tsc --noEmit
pnpm lint          # ESLint + check-handwritten-paths
```
