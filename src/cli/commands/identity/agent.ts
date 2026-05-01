import type { Command } from "commander";
import { requirePrincipalId, requireAgentId } from "../../../config/profiles.js";
import { saveConfig } from "../../../config/config.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";

export function registerAgentCommands(program: Command): void {
  const agent = program.command("agent").description("Manage agents");

  agent
    .command("register")
    .description("Register a new agent for the current principal")
    .option("--name <name>", "Display name")
    .option("--description <desc>", "Description")
    .option("--capabilities <caps>", "Comma-separated capability list")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, config, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);

        const a = await client.registerAgent({
          principalId,
          displayName: opts.name as string | undefined,
          description: opts.description as string | undefined,
          capabilities: opts.capabilities
            ? (opts.capabilities as string).split(",").map((s: string) => s.trim())
            : undefined,
        });

        profile.agentId = a.id;
        config.profiles[profile.name] = profile;
        saveConfig(config);

        printOutput(outputOk(a), Boolean(opts.json), (d) =>
          `Registered agent: ${String((d as { id: string }).id)} (saved to profile)`,
        );
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  agent
    .command("show")
    .description("Show current agent details")
    .option("--id <id>", "Agent ID (defaults to profile agentId)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const id = (opts.id as string | undefined) ?? requireAgentId(profile);
        const a = await client.getAgent(id);
        printOutput(outputOk(a), Boolean(opts.json), (d) =>
          `Agent: ${String((d as { id: string }).id)}\nStatus: ${String((d as { status?: string }).status ?? "unknown")}`,
        );
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  agent
    .command("availability")
    .description("Change agent availability status")
    .argument("<status>", "New status (available|busy|offline)")
    .option("--reason <reason>", "Reason for status change")
    .option("--json", "Output as JSON")
    .action(async (status: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const agentId = requireAgentId(profile);
        const a = await client.changeAgentStatus(agentId, {
          nextStatus: status,
          reason: opts.reason as string | undefined,
        });
        printOutput(outputOk(a), Boolean(opts.json), () => `Agent status updated to '${ status }'`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  agent
    .command("bind-runtime")
    .description("Create a runtime binding for the current agent")
    .requiredOption("--kind <kind>", "Runtime kind (e.g. script, docker, wasm)")
    .option("--capabilities <caps>", "Comma-separated capabilities")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, config, profile } = getCoordinatorClient();
        const agentId = requireAgentId(profile);
        const binding = await client.createRuntimeBinding(agentId, {
          runtimeKind: opts.kind as string,
          capabilities: opts.capabilities
            ? (opts.capabilities as string).split(",").map((s: string) => s.trim())
            : undefined,
        });

        profile.defaultRuntimeBindingId = (binding as { id: string }).id;
        config.profiles[profile.name] = profile;
        saveConfig(config);

        printOutput(outputOk(binding), Boolean(opts.json), (d) =>
          `Runtime binding created: ${String((d as { id: string }).id)} (saved as default)`,
        );
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}

