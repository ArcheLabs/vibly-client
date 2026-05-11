import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { requirePrincipalId } from "../../../config/profiles.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";

export function registerDiscussionCommands(program: Command): void {
  const discussion = program.command("discussion").description("Participate in discussions");

  discussion
    .command("contribute")
    .description("Contribute to a discussion")
    .requiredOption("--discussion-id <id>", "Discussion ID")
    .requiredOption("--content <text>", "Contribution content")
    .option("--format <fmt>", "Content format: markdown|text", "markdown")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const tags = opts.tags ? (opts.tags as string).split(",").map((t: string) => t.trim()) : undefined;
        const receipt = await client.submitActionIntent({
          type: "ContributeToDiscussion",
          principalId,
          projectId: profile.projectId,
          payload: {
            discussionId: opts.discussionId as string,
            contribution: {
              content: opts.content as string,
              contentFormat: (opts.format as "markdown" | "text") ?? "markdown",
              tags,
            },
          },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Discussion contribution submitted (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
