import type { Command } from "commander";
import { CoordinatorClient } from "../../coordinator/client.js";
import { loadActiveProfile, requireApiToken } from "../../config/profiles.js";
import { outputErr, outputOk, printOutput } from "../../domain/apiTypes.js";
import { ClientError } from "../../domain/errors.js";

export function registerPhaseHCommands(program: Command): void {
  const phaseH = program.command("phase-h").description("Run and inspect the Phase H incentive/risk smoke loop");

  phaseH
    .command("smoke")
    .description("Run the dev-only Phase H mock ledger, reputation, slash, and Guardian risk smoke")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getClient();
        const result = await client.runPhaseHSmoke();
        printOutput(outputOk(result), Boolean(opts.json), summarizeRun);
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  phaseH
    .command("runs")
    .description("List recorded Phase H smoke runs")
    .option("--project-id <id>", "Filter by project id")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getClient();
        const result = await client.listPhaseHRuns({ projectId: opts.projectId, limit: Number(opts.limit) });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const rows = items as unknown[];
          if (!rows.length) return "No Phase H runs";
          return rows.map((row) => summarizeRun(row)).join("\n\n");
        });
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  phaseH
    .command("status")
    .description("Show the Phase H project overview")
    .requiredOption("--project-id <id>", "Project id")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getClient();
        const result = await client.getPhaseHOverview(opts.projectId);
        printOutput(outputOk(result), Boolean(opts.json), summarizeOverview);
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });
}

function summarizeRun(value: unknown): string {
  const run = asRecord(asRecord(value).run ?? value);
  const reward = asRecord(run.rewardIntent);
  const slash = asRecord(run.slashRequest);
  const positive = asRecord(run.positiveEvidence);
  const negative = asRecord(run.negativeEvidence);
  return [
    `Phase H run: ${String(run.id ?? "-")}`,
    `Project: ${String(run.projectId ?? "-")} | Phase F: ${String(run.phaseFRunId ?? "-")}`,
    `Reward: ${String(reward.id ?? "-")} (${String(reward.status ?? "unknown")}, ${String(reward.amount ?? "-")} ${String(reward.currency ?? "")})`,
    `Reputation: +${String(positive.scoreDelta ?? "-")} / ${String(negative.scoreDelta ?? "-")}`,
    `Slash: ${String(slash.id ?? "-")} (${String(slash.status ?? "unknown")}, ${String(slash.severity ?? "unknown")})`,
  ].join("\n");
}

function summarizeOverview(value: unknown): string {
  const overview = asRecord(asRecord(value).overview ?? value);
  const counts = asRecord(overview.counts);
  const ledger = asRecord(overview.ledger);
  const byStatus = asRecord(ledger.byStatus);
  return [
    `Phase H status: ${String(overview.projectId ?? "-")}`,
    `Runs: ${String(counts.phaseHRuns ?? 0)} | Rewards: ${String(counts.rewardIntents ?? 0)} | Claimable: ${String(counts.claimableRewards ?? byStatus.claimable ?? 0)}`,
    `Reputation evidence: ${String(counts.reputationEvidence ?? 0)} | Slash requests: ${String(counts.slashRequests ?? 0)} | Guardian requests: ${String(counts.guardianRequests ?? 0)}`,
  ].join("\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getClient() {
  const { config, profile } = loadActiveProfile();
  const token = requireApiToken(profile);
  const client = new CoordinatorClient({ baseUrl: profile.coordinatorUrl, token });
  return { client, config, profile };
}

function handleError(e: unknown, json?: boolean): void {
  if (e instanceof ClientError) {
    printOutput(outputErr(e.code, e.message, e.hint), Boolean(json));
  } else {
    printOutput(outputErr("COORDINATOR_API_ERROR", String(e)), Boolean(json));
  }
  process.exitCode = 1;
}
