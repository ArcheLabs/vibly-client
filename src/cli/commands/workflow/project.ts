import type { Command } from "commander";
import { requireProjectId } from "../../../config/profiles.js";
import { saveConfig } from "../../../config/config.js";
import { outputOk, outputErr, printOutput } from "../../../domain/apiTypes.js";

import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
export function registerProjectCommands(program: Command): void {
  const project = program.command("project").description("Manage projects");

  project
    .command("list")
    .description("List projects")
    .option("--status <status>", "Filter by status")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.listProjects({
          status: opts.status as string | undefined,
          limit: parseInt(opts.limit as string, 10),
        });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as Array<{ id: string; slug?: string; name?: string; status?: string }>;
          if (arr.length === 0) return "No projects found";
          return arr.map((p) => `  ${p.slug ?? p.id}  ${p.name ?? ""}  (${p.status ?? ""})`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  project
    .command("use")
    .description("Set the active project")
    .argument("<id-or-slug>", "Project ID or slug")
    .option("--json", "Output as JSON")
    .action(async (idOrSlug: string, opts) => {
      try {
        const { client, config, profile } = getCoordinatorClient();
        const result = await client.listProjects({ limit: 100 });
        const found = result.items.find(
          (p: { id: string; slug?: string }) => p.id === idOrSlug || p.slug === idOrSlug,
        );
        if (!found) {
          printOutput(outputErr("COORDINATOR_API_ERROR", `Project '${ idOrSlug }' not found`), Boolean(opts.json));
          process.exitCode = 1;
          return;
        }
        profile.projectId = (found as { id: string }).id;
        config.profiles[profile.name] = profile;
        saveConfig(config);
        printOutput(outputOk(found), Boolean(opts.json), () => `Active project set to '${ idOrSlug }'`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  project
    .command("show")
    .description("Show active project details")
    .option("--id <id>", "Project ID (defaults to profile projectId)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const id = (opts.id as string | undefined) ?? requireProjectId(profile);
        const p = await client.getProject(id);
        printOutput(outputOk(p), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  project
    .command("objectives")
    .description("List project objectives")
    .option("--id <id>", "Project ID (defaults to profile projectId)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const id = (opts.id as string | undefined) ?? requireProjectId(profile);
        const result = await client.listObjectives(id);
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as Array<{ id: string; title?: string; status?: string }>;
          if (arr.length === 0) return "No objectives found";
          return arr.map((o) => `  ${o.id}  ${o.title ?? ""}  (${o.status ?? ""})`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  project
    .command("boundary")
    .description("Show project boundary/rules")
    .option("--id <id>", "Project ID (defaults to profile projectId)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const id = (opts.id as string | undefined) ?? requireProjectId(profile);
        const b = await client.getBoundary(id);
        if (!b) {
          printOutput(outputErr("COORDINATOR_API_ERROR", "No boundary defined for project"), Boolean(opts.json));
          process.exitCode = 1;
          return;
        }
        printOutput(outputOk(b), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
