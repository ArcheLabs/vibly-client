import type { Command } from "commander";
import {
  incentiveRiskStatusAction,
  listAgentCollaborationScenarioRunsAction,
  listIncentiveRiskScenarioRunsAction,
  runAgentCollaborationScenarioAction,
  runIncentiveRiskScenarioAction,
} from "./scenarios.js";

/**
 * Deprecated `phase-f` / `phase-h` aliases.
 *
 * These names come from the original Concord roadmap (Phase F = test-agent
 * collaboration, Phase H = incentive/risk loop). They are *not* domain
 * concepts and have been superseded by `vibly scenarios ...`.
 *
 * Keep these aliases registered so existing scripts and operator runbooks
 * continue to work; they delegate to the same handlers as the semantic
 * commands. New code, examples, and documentation should reference
 * `vibly scenarios agent-collaboration` / `vibly scenarios incentive-risk`.
 */
export function registerPhaseAliasCommands(program: Command): void {
  const phaseF = program
    .command("phase-f")
    .description("Deprecated alias for `vibly scenarios agent-collaboration`");

  phaseF
    .command("smoke")
    .description("Deprecated alias for `vibly scenarios agent-collaboration run`")
    .option("--json", "Output as JSON")
    .action((opts) => runAgentCollaborationScenarioAction({ json: Boolean(opts.json) }));

  phaseF
    .command("runs")
    .description("Deprecated alias for `vibly scenarios agent-collaboration runs`")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action((opts) =>
      listAgentCollaborationScenarioRunsAction({
        limit: opts.limit as string | undefined,
        json: Boolean(opts.json),
      }),
    );

  const phaseH = program
    .command("phase-h")
    .description("Deprecated alias for `vibly scenarios incentive-risk`");

  phaseH
    .command("smoke")
    .description("Deprecated alias for `vibly scenarios incentive-risk run`")
    .option("--json", "Output as JSON")
    .action((opts) => runIncentiveRiskScenarioAction({ json: Boolean(opts.json) }));

  phaseH
    .command("runs")
    .description("Deprecated alias for `vibly scenarios incentive-risk runs`")
    .option("--project-id <id>", "Filter by project id")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action((opts) =>
      listIncentiveRiskScenarioRunsAction({
        projectId: opts.projectId as string | undefined,
        limit: opts.limit as string | undefined,
        json: Boolean(opts.json),
      }),
    );

  phaseH
    .command("status")
    .description("Deprecated alias for `vibly scenarios incentive-risk status`")
    .requiredOption("--project-id <id>", "Project id")
    .option("--json", "Output as JSON")
    .action((opts) =>
      incentiveRiskStatusAction({
        projectId: opts.projectId as string,
        json: Boolean(opts.json),
      }),
    );
}
