import type { Command } from "commander";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import type { OrganizationSnapshot } from "../../../domain/clientTypes.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";

export function registerOrganizationCommands(program: Command): void {
  const organizations = program.command("organizations").description("Manage organizations");

  organizations
    .command("list")
    .description("List organizations")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.listOrganizations({ limit: 50 });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as OrganizationSnapshot[];
          if (arr.length === 0) return "No organizations found";
          return arr.map((o) => `  ${o.id}  ${o.name}  [${o.status}]`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  organizations
    .command("show <id>")
    .description("Show organization details")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client } = getCoordinatorClient();
        const org = await client.getOrganization(id);
        if (!org) {
          console.error(`Organization not found: ${id}`);
          process.exit(1);
        }
        printOutput(outputOk(org), Boolean(opts.json), (o) => {
          const snap = o as OrganizationSnapshot;
          return [`ID:     ${snap.id}`, `Name:   ${snap.name}`, `Status: ${snap.status}`].join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
