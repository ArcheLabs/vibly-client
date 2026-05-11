import type { Command } from "commander";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";

export function registerQueueCommands(program: Command): void {
  const queue = program.command("queue").description("View assignment queues");

  queue
    .command("obligations")
    .description("List pending obligations")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await client.listObligations({ agentId: profile.agentId, status: "pending", limit: 50 });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as unknown[];
          if (arr.length === 0) return "No pending obligations";
          return arr.map((i) => JSON.stringify(i)).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  queue
    .command("observations")
    .description("List observation assignments")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await client.listObservationAssignments({ agentId: profile.agentId, limit: 50 });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as unknown[];
          if (arr.length === 0) return "No observation assignments";
          return arr.map((i) => JSON.stringify(i)).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  queue
    .command("discussions")
    .description("List discussion participation assignments")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await client.listDiscussionParticipations({ agentId: profile.agentId, limit: 50 });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as unknown[];
          if (arr.length === 0) return "No discussion assignments";
          return arr.map((i) => JSON.stringify(i)).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  queue
    .command("tasks")
    .description("List available tasks")
    .option("--project-id <id>", "Filter by project ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await client.listAvailableTasks({
          projectId: (opts.projectId as string | undefined) ?? profile.projectId,
          limit: 50,
        });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as unknown[];
          if (arr.length === 0) return "No available tasks";
          return arr.map((i) => JSON.stringify(i)).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  queue
    .command("reviews")
    .description("List review assignments")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await client.listReviewAssignments({ agentId: profile.agentId, limit: 50 });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as unknown[];
          if (arr.length === 0) return "No review assignments";
          return arr.map((i) => JSON.stringify(i)).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  queue
    .command("votes")
    .description("List voting assignments (open negotiations)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await client.listVotingAssignments({ agentId: profile.agentId, limit: 50 });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as unknown[];
          if (arr.length === 0) return "No open negotiations to vote on";
          return arr.map((i) => JSON.stringify(i)).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
