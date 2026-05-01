import type { Command } from "commander";
import { requirePrincipalId } from "../../../config/profiles.js";
import { saveConfig } from "../../../config/config.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";

export function registerPrincipalCommands(program: Command): void {
  const principal = program.command("principal").description("Manage principals");

  principal
    .command("register")
    .description("Register a new principal on the coordinator")
    .option("--kind <kind>", "Principal kind (human|organization|agent|system)", "human")
    .option("--name <name>", "Display name")
    .option("--description <desc>", "Description")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, config, profile } = getCoordinatorClient();

        const p = await client.registerPrincipal({
          kind: opts.kind as string,
          displayName: opts.name as string | undefined,
          description: opts.description as string | undefined,
        });

        // Save principalId to profile
        profile.principalId = p.id;
        config.profiles[profile.name] = profile;
        saveConfig(config);

        printOutput(outputOk(p), Boolean(opts.json), (d) =>
          `Registered principal: ${String((d as { id: string }).id)} (saved to profile)`,
        );
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  principal
    .command("show")
    .description("Show current principal details")
    .option("--id <id>", "Principal ID (defaults to profile principalId)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const id = (opts.id as string | undefined) ?? requirePrincipalId(profile);
        const p = await client.getPrincipal(id);
        printOutput(outputOk(p), Boolean(opts.json), (d) =>
          `Principal: ${String((d as { id: string }).id)}\nStatus: ${String((d as { status?: string }).status ?? "unknown")}`,
        );
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  principal
    .command("bind-address")
    .description("Bind a blockchain address to the principal")
    .requiredOption("--chain <chain>", "Chain name (e.g. ethereum, solana)")
    .requiredOption("--address <address>", "Wallet address")
    .option("--public-key <key>", "Public key")
    .option("--proof <proof>", "Signature proof")
    .option("--id <id>", "Principal ID (defaults to profile principalId)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const id = (opts.id as string | undefined) ?? requirePrincipalId(profile);
        const p = await client.bindPrincipalAddress(id, {
          chain: opts.chain as string,
          address: opts.address as string,
          publicKey: opts.publicKey as string | undefined,
          proof: opts.proof as string | undefined,
        });
        printOutput(outputOk(p), Boolean(opts.json), () => `Address bound successfully`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  principal
    .command("list")
    .description("List principals")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.listPrincipals({ limit: parseInt(opts.limit as string, 10) });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as Array<{ id: string; displayName?: string; kind?: string }>;
          if (arr.length === 0) return "No principals found";
          return arr.map((p) => `  ${p.id}  ${p.displayName ?? ""}  (${p.kind ?? ""})`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}

