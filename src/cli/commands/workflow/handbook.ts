import type { Command } from "commander";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";

export function registerHandbookCommands(program: Command): void {
  const handbook = program.command("handbook").description("View project handbooks");

  handbook
    .command("show")
    .description("Show the handbook for the current project")
    .option("--project-id <id>", "Project ID (defaults to profile.projectId)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const projectId = (opts.projectId as string | undefined) ?? profile.projectId;
        if (!projectId) {
          console.error("No project ID. Use --project-id or set projectId in your profile.");
          process.exit(1);
        }
        const handbook = await client.getProjectHandbook(projectId);
        if (!handbook) {
          console.error(`Handbook not found for project: ${projectId}`);
          process.exit(1);
        }
        printOutput(outputOk(handbook), Boolean(opts.json), (h) => {
          const snap = h as typeof handbook;
          return `Project: ${snap.projectId}\nUpdated: ${snap.updatedAt}\n\n${JSON.stringify(snap.content, null, 2)}`;
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
