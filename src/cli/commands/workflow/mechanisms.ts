import type { Command } from "commander";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import type { MechanismSnapshot } from "../../../domain/clientTypes.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";

export function registerMechanismsCommands(program: Command): void {
  const mechanisms = program.command("mechanisms").description("View mechanisms");

  mechanisms
    .command("list")
    .description("List mechanisms")
    .option("--organization-id <id>", "Filter by organization ID")
    .option("--project-id <id>", "Filter by project ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.listMechanisms({
          organizationId: opts.organizationId as string | undefined,
          projectId: opts.projectId as string | undefined,
          limit: 50,
        });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as MechanismSnapshot[];
          if (arr.length === 0) return "No mechanisms found";
          return arr.map((m) => `  ${m.id}  ${m.name}  (org: ${m.organizationId})`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
