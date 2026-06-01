import type { Command } from "commander";

import { registerConfigCommands } from "./core/config.js";
import { registerLoginCommands } from "./core/login.js";
import { registerStatusCommands } from "./core/status.js";
import { registerDoctorCommands } from "./core/doctor.js";
import { registerBootstrapCommands } from "./core/bootstrap.js";

import { registerAgentCommands } from "./identity/agent.js";
import { registerPrincipalCommands } from "./identity/principal.js";
import { registerRuntimeCommands } from "./identity/runtime.js";

import { registerContextCommands } from "./workflow/context.js";
import { registerKnowledgeCommands } from "./workflow/knowledge.js";
import { registerOrganizationCommands } from "./workflow/organization.js";
import { registerHandbookCommands } from "./workflow/handbook.js";
import { registerMechanismsCommands } from "./workflow/mechanisms.js";
import { registerQueueCommands } from "./workflow/queue.js";
import { registerObservationCommands } from "./workflow/observation.js";
import { registerDiscussionCommands } from "./workflow/discussion.js";
import { registerProposalCommands } from "./workflow/proposal.js";
import { registerTaskCommands } from "./workflow/task.js";
import { registerProjectCommands } from "./workflow/project.js";
import { registerReviewCommands } from "./workflow/review.js";
import { registerRewardCommands } from "./workflow/rewards.js";

import { registerGovernanceCommands } from "./governance/governance.js";
import { registerNegotiationCommands } from "./governance/negotiation.js";
import { registerVotingCommands } from "./governance/voting.js";

import { registerDaemonCommands } from "./observability/daemon.js";
import { registerLogsCommands } from "./observability/logs.js";
import { registerEventCommands } from "./observability/events.js";
import { registerSyncCommands } from "./observability/sync.js";
import { registerTraceCommands } from "./observability/trace.js";

import { registerMemoryCommands } from "./memory/memory.js";
import { registerUpgradeCommands } from "./maintenance/upgrade.js";

import { registerScenarioCommands } from "./dev/scenarios.js";

/**
 * Register every CLI subcommand on the given Commander program.
 *
 * Grouped roughly by domain so `vibly --help` lists related commands
 * together. Adding a new command means adding a `register*` import and
 * call here, rather than touching `src/cli/index.ts`.
 */
export function registerCommands(program: Command): void {
  registerConfigCommands(program);
  registerStatusCommands(program);
  registerDoctorCommands(program);
  registerBootstrapCommands(program);
  registerLoginCommands(program);

  registerPrincipalCommands(program);
  registerAgentCommands(program);
  registerRuntimeCommands(program);

  registerOrganizationCommands(program);
  registerHandbookCommands(program);
  registerMechanismsCommands(program);

  registerProjectCommands(program);
  registerContextCommands(program);
  registerKnowledgeCommands(program);

  registerQueueCommands(program);
  registerObservationCommands(program);
  registerDiscussionCommands(program);
  registerProposalCommands(program);
  registerTaskCommands(program);
  registerReviewCommands(program);
  registerRewardCommands(program);

  registerNegotiationCommands(program);
  registerVotingCommands(program);
  registerGovernanceCommands(program);

  registerEventCommands(program);
  registerTraceCommands(program);
  registerSyncCommands(program);
  registerDaemonCommands(program);
  registerLogsCommands(program);

  registerScenarioCommands(program);
  registerMemoryCommands(program);
  registerUpgradeCommands(program);
}
