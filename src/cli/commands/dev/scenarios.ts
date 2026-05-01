import type { Command } from "commander";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
import { asRecord } from "../shared/format.js";

/**
 * Semantic CLI surface for the dev/demo coordinator scenarios.
 *
 * These commands replace the historic `phase-f` / `phase-h` entry points.
 * The handlers themselves are exported so the deprecated phase-* aliases
 * (see `phase-aliases.ts`) can reuse them without duplication.
 */
export function registerScenarioCommands(program: Command): void {
  const scenarios = program
    .command("scenarios")
    .description("Run dev/demo coordinator scenarios (agent collaboration, incentive/risk)");

  const agentCollab = scenarios
    .command("agent-collaboration")
    .description("Observer/Delegate/Worker/Reviewer/Guardian collaboration scenario");

  agentCollab
    .command("run")
    .description("Run the agent-collaboration scenario end-to-end")
    .option("--json", "Output as JSON")
    .action((opts) => runAgentCollaborationScenarioAction(opts as ScenarioOpts));

  agentCollab
    .command("runs")
    .description("List recorded agent-collaboration scenario runs")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action((opts) => listAgentCollaborationScenarioRunsAction(opts as ScenarioListOpts));

  const incentiveRisk = scenarios
    .command("incentive-risk")
    .description("Mock-ledger incentive + risk scenario (rewards, reputation, slash, Guardian)");

  incentiveRisk
    .command("run")
    .description("Run the incentive/risk scenario end-to-end")
    .option("--json", "Output as JSON")
    .action((opts) => runIncentiveRiskScenarioAction(opts as ScenarioOpts));

  incentiveRisk
    .command("runs")
    .description("List recorded incentive/risk scenario runs")
    .option("--project-id <id>", "Filter by project id")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action((opts) => listIncentiveRiskScenarioRunsAction(opts as IncentiveRiskListOpts));

  incentiveRisk
    .command("status")
    .description("Show the incentive/risk overview for a project")
    .requiredOption("--project-id <id>", "Project id")
    .option("--json", "Output as JSON")
    .action((opts) => incentiveRiskStatusAction(opts as IncentiveRiskStatusOpts));
}

interface ScenarioOpts {
  json?: boolean;
}

interface ScenarioListOpts extends ScenarioOpts {
  limit?: string;
}

interface IncentiveRiskListOpts extends ScenarioListOpts {
  projectId?: string;
}

interface IncentiveRiskStatusOpts extends ScenarioOpts {
  projectId: string;
}

export async function runAgentCollaborationScenarioAction(opts: ScenarioOpts): Promise<void> {
  try {
    const { client } = getCoordinatorClient();
    const result = await client.runAgentCollaborationScenario();
    printOutput(outputOk(result), Boolean(opts.json), summarizeAgentCollaborationRun);
  } catch (e) {
    handleCliError(e, opts.json);
  }
}

export async function listAgentCollaborationScenarioRunsAction(opts: ScenarioListOpts): Promise<void> {
  try {
    const { client } = getCoordinatorClient();
    const result = await client.listAgentCollaborationScenarioRuns({ limit: Number(opts.limit ?? 20) });
    printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
      const rows = items as unknown[];
      if (!rows.length) return "No agent-collaboration runs";
      return rows.map((row) => summarizeAgentCollaborationRun(row)).join("\n\n");
    });
  } catch (e) {
    handleCliError(e, opts.json);
  }
}

export async function runIncentiveRiskScenarioAction(opts: ScenarioOpts): Promise<void> {
  try {
    const { client } = getCoordinatorClient();
    const result = await client.runIncentiveRiskScenario();
    printOutput(outputOk(result), Boolean(opts.json), summarizeIncentiveRiskRun);
  } catch (e) {
    handleCliError(e, opts.json);
  }
}

export async function listIncentiveRiskScenarioRunsAction(opts: IncentiveRiskListOpts): Promise<void> {
  try {
    const { client } = getCoordinatorClient();
    const result = await client.listIncentiveRiskScenarioRuns({
      projectId: opts.projectId,
      limit: Number(opts.limit ?? 20),
    });
    printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
      const rows = items as unknown[];
      if (!rows.length) return "No incentive/risk runs";
      return rows.map((row) => summarizeIncentiveRiskRun(row)).join("\n\n");
    });
  } catch (e) {
    handleCliError(e, opts.json);
  }
}

export async function incentiveRiskStatusAction(opts: IncentiveRiskStatusOpts): Promise<void> {
  try {
    const { client } = getCoordinatorClient();
    const result = await client.getProjectOverview(opts.projectId);
    printOutput(outputOk(result), Boolean(opts.json), summarizeIncentiveRiskOverview);
  } catch (e) {
    handleCliError(e, opts.json);
  }
}

function summarizeAgentCollaborationRun(value: unknown): string {
  const run = asRecord(asRecord(value)["run"] ?? value);
  const action = asRecord(run["action"]);
  const workOrder = asRecord(run["workOrder"]);
  const reviewAggregation = asRecord(run["reviewAggregation"]);
  const guardianRequest = asRecord(run["guardianRequest"]);
  const trace = asRecord(run["trace"]);
  const verification = asRecord(run["verification"]);
  const replay = asRecord(run["replay"]);
  return [
    `Agent collaboration run: ${String(run["id"] ?? action["id"] ?? "-")}`,
    `Action: ${String(action["title"] ?? "-")} (${String(action["riskLevel"] ?? "unknown")})`,
    `Work: ${String(workOrder["status"] ?? "unknown")} | Review: ${String(reviewAggregation["result"] ?? "unknown")} | Guardian: ${String(guardianRequest["status"] ?? "unknown")}`,
    `Trace: ${String(trace["traceId"] ?? "-")} | verify=${String(verification["ok"] ?? false)} replay=${String(replay["ok"] ?? false)}`,
  ].join("\n");
}

function summarizeIncentiveRiskRun(value: unknown): string {
  const run = asRecord(asRecord(value).run ?? value);
  const reward = asRecord(run.rewardIntent);
  const slash = asRecord(run.slashRequest);
  const positive = asRecord(run.positiveEvidence);
  const negative = asRecord(run.negativeEvidence);
  return [
    `Incentive/risk run: ${String(run.id ?? "-")}`,
    `Project: ${String(run.projectId ?? "-")} | Agent collaboration run: ${String(run.phaseFRunId ?? "-")}`,
    `Reward: ${String(reward.id ?? "-")} (${String(reward.status ?? "unknown")}, ${String(reward.amount ?? "-")} ${String(reward.currency ?? "")})`,
    `Reputation: +${String(positive.scoreDelta ?? "-")} / ${String(negative.scoreDelta ?? "-")}`,
    `Slash: ${String(slash.id ?? "-")} (${String(slash.status ?? "unknown")}, ${String(slash.severity ?? "unknown")})`,
  ].join("\n");
}

function summarizeIncentiveRiskOverview(value: unknown): string {
  const overview = asRecord(asRecord(value).overview ?? value);
  const counts = asRecord(overview.counts);
  const ledger = asRecord(overview.ledger);
  const byStatus = asRecord(ledger.byStatus);
  return [
    `Incentive/risk status: ${String(overview.projectId ?? "-")}`,
    `Runs: ${String(counts.phaseHRuns ?? 0)} | Rewards: ${String(counts.rewardIntents ?? 0)} | Claimable: ${String(counts.claimableRewards ?? byStatus.claimable ?? 0)}`,
    `Reputation evidence: ${String(counts.reputationEvidence ?? 0)} | Slash requests: ${String(counts.slashRequests ?? 0)} | Guardian requests: ${String(counts.guardianRequests ?? 0)}`,
  ].join("\n");
}
