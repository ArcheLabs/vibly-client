import { Command } from "commander";
import { registerConfigCommands } from "./commands/config.js";
import { registerStatusCommands } from "./commands/status.js";
import { registerLoginCommands } from "./commands/login.js";
import { registerPrincipalCommands } from "./commands/principal.js";
import { registerAgentCommands } from "./commands/agent.js";
import { registerRuntimeCommands } from "./commands/runtime.js";
import { registerProjectCommands } from "./commands/project.js";
import { registerSyncCommands } from "./commands/sync.js";
import { registerContextCommands } from "./commands/context.js";
import { registerKnowledgeCommands } from "./commands/knowledge.js";
import { registerWorkCommands } from "./commands/work.js";
import { registerVoteCommands } from "./commands/vote.js";
import { registerNegotiationCommands } from "./commands/negotiation.js";
import { registerReviewCommands } from "./commands/review.js";
import { registerRewardCommands } from "./commands/rewards.js";
import { registerEventCommands } from "./commands/events.js";
import { registerTraceCommands } from "./commands/trace.js";
import { registerDaemonCommands } from "./commands/daemon.js";
import { registerGovernanceCommands } from "./commands/governance.js";
import { registerPhaseFCommands } from "./commands/phase-f.js";
import { registerPhaseHCommands } from "./commands/phase-h.js";

export function buildCli(): Command {
  const program = new Command();

  program
    .name("vibly")
    .description("Vibly Agent Node CLI")
    .version("0.1.0")
    .option("--profile <name>", "Profile to use")
    .option("--config <path>", "Config file path")
    .option("--json", "Output as machine-readable JSON")
    .option("--verbose", "Verbose logging")
    .option("--coordinator-url <url>", "Override coordinator URL")
    .option("--api-token <token>", "Override API token")
    .hook("preAction", (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.profile) process.env["VIBLY_PROFILE"] = opts.profile;
      if (opts.coordinatorUrl) process.env["VIBLY_COORDINATOR_URL_OVERRIDE"] = opts.coordinatorUrl;
      if (opts.apiToken) process.env["VIBLY_API_TOKEN"] = opts.apiToken;
    });

  registerConfigCommands(program);
  registerStatusCommands(program);
  registerLoginCommands(program);
  registerPrincipalCommands(program);
  registerAgentCommands(program);
  registerRuntimeCommands(program);
  registerProjectCommands(program);
  registerSyncCommands(program);
  registerContextCommands(program);
  registerKnowledgeCommands(program);
  registerWorkCommands(program);
  registerVoteCommands(program);
  registerNegotiationCommands(program);
  registerReviewCommands(program);
  registerRewardCommands(program);
  registerEventCommands(program);
  registerTraceCommands(program);
  registerDaemonCommands(program);
  registerGovernanceCommands(program);
  registerPhaseFCommands(program);
  registerPhaseHCommands(program);

  return program;
}
