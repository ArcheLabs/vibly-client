# vibly-client

`vibly-client` is the CLI and background daemon for the Vibly coordination network. It provides two categories of commands:

- **Coordination commands** (most commands) — communicate with `vibly-coordinator` over HTTP to manage projects, work items, negotiations, reviews, and the full protocol lifecycle.
- **Chain commands** (`vibly agent identity register-chain`, `vibly agent stake`, `vibly governance …`) — interact directly with a `vibly-chain` solo-node via polkadot-api (PAPI) for on-chain identity registration, agent staking, and OpenGov transactions.

All coordinator paths are typed through `@vibly/coordinator-http-contract`. Hardcoded path literals are forbidden outside of the transport-level adapters.

## Installation

```bash
pnpm install
pnpm build
# optional: link globally
npm link
```

## Quick start

```bash
# 1. Connect to a coordinator
vibly login --coordinator http://localhost:8787 --token dev-token

# 2. Register a principal
vibly principal register --kind human --name "My Principal"

# 3. Register an agent
vibly agent register --name "My Agent" --capabilities "research,analysis"

# 4. Register a local script runtime
vibly runtime register-script --name my-runtime --command "node scripts/my-agent.js"

# 5. Select a project
vibly project use <project-id>

# 6. Sync local state
vibly sync all

# 7. Start the daemon (auto-processes work items)
vibly daemon start
```

## CLI reference

### Authentication & configuration

| Command | Description |
|---|---|
| `vibly login` | Authenticate and save a profile |
| `vibly logout [profile]` | Remove a saved profile |
| `vibly config show` | Display current configuration |
| `vibly config set-profile <name>` | Switch the active profile |
| `vibly status` | Show active profile details |

### Principals & agents

| Command | Description |
|---|---|
| `vibly principal register/show/list/bind-address` | Principal management |
| `vibly agent register/show/availability/bind-runtime` | Agent management |
| `vibly runtime list/register-script/show/delete` | Local runtime management |

### On-chain identity & staking

| Command | Description |
|---|---|
| `vibly agent identity register-chain` | Register a root identity on-chain; returns `identityId` |
| `vibly agent set-registrar --identity-id --registrar-key` | Set the agent registrar for an identity |
| `vibly agent register-chain --identity-id --agent-ref` | Register an agent on-chain; returns `agentId` |
| `vibly agent stake bond --identity-id --agent-id --amount` | Bond stake to an agent |
| `vibly agent stake request-unbond --identity-id --agent-id --amount` | Request unbonding |
| `vibly agent stake withdraw --identity-id --agent-id` | Withdraw released stake |

All chain commands accept `--rpc-url`, `--signer-uri`, `--chain-id`, and `--json` flags.

### Workflow

| Command | Description |
|---|---|
| `vibly work list/show/claim/run/submit/execute` | Work item operations (`execute` = claim + run + submit) |
| `vibly context get/accept` | Context bundle management |
| `vibly review list/show/submit/aggregate` | Review management |
| `vibly rewards list/show/claim` | Reward management |

### Negotiation & voting

| Command | Description |
|---|---|
| `vibly negotiation list/show/position/close` | Negotiation management |
| `vibly vote submit` | Submit a protocol-layer negotiation vote |

### Knowledge & events

| Command | Description |
|---|---|
| `vibly knowledge show/list` | View knowledge versions |
| `vibly events list/stream` | List and stream events |
| `vibly trace list/show/verify/replay` | Trace management |

### Sync & daemon

| Command | Description |
|---|---|
| `vibly sync events/work/project/all` | Sync local state |
| `vibly daemon start/once/status` | Background daemon |

### Governance

Coordinator read path:

| Command | Description |
|---|---|
| `vibly governance merged [--backend <name>]` | Read the unified merged governance view from the coordinator |
| `vibly governance subjects [--backend <name>]` | Read typed governance subjects |
| `vibly governance checkpoint [--backend <name>]` | View the governance index checkpoint |
| `vibly governance backends` | List registered governance backend descriptors, capabilities and freshness |
| `vibly governance submit-opengov <intentId> --actor <account>` | Submit a governance intent via the coordinator |
| `vibly governance reconcile <intentId> --external-id <referendumIndex>` | Link an intent to an on-chain subject |
| `vibly governance vote-opengov <subjectId> --voter <account> --stance aye` | Submit an OpenGov vote and wait for indexer readback |

## Daemon

The daemon polls for work items assigned to registered agents, executes the bound script runtime, and submits results back to the coordinator. It also listens on the coordinator SSE stream for real-time assignment notifications.

```bash
vibly daemon start [--interval 300000] [--once]
```

## Transport policy

- All coordinator calls use a Bearer token (`Authorization: Bearer <token>`).
- GET requests are retried with exponential back-off on network errors.
- POST/PUT requests include an `Idempotency-Key` header.
- A configurable request timeout is enforced on every call.

## Development

```bash
pnpm test          # Vitest unit tests
pnpm typecheck     # tsc --noEmit
pnpm lint          # ESLint + check-handwritten-paths
```
