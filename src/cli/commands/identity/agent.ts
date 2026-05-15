import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { loadActiveProfile, requirePrincipalId, requireAgentId } from "../../../config/profiles.js";
import { saveConfig } from "../../../config/config.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
import { submitAgentStakeTx } from "../../../chain/agentStaking.js";
import { submitIdentityOnboardingTx } from "../../../chain/identityOnboarding.js";

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
    .command("pause")
    .description("Pause public-duty eligibility for the current agent")
    .option("--reason <reason>", "Reason for pausing public duties")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const receipt = await client.submitActionIntent({
          type: "RequestAgentDutyPause",
          principalId,
          payload: { principalId, reason: opts.reason as string | undefined },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Agent public duties paused (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  agent
    .command("resume")
    .description("Resume public-duty eligibility for the current agent")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const receipt = await client.submitActionIntent({
          type: "ResumeAgentDuty",
          principalId,
          payload: { principalId },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Agent public duties resumed (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  const stake = agent.command("stake").description("Manage chain-backed agent stake");

  stake
    .command("status")
    .description("Show stake ledgers synced by coordinator")
    .option("--principal-id <id>", "Principal ID (defaults to active profile principal)")
    .option("--chain-id <id>", "Chain ID filter")
    .option("--status <status>", "Stake status filter (active|unbonding|released)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = (opts.principalId as string | undefined) ?? profile.principalId;
        const result = await client.listAgentStakes({
          principalId,
          chainId: opts.chainId as string | undefined,
          status: opts.status as string | undefined,
          limit: 50,
        });
        printOutput(outputOk(result), Boolean(opts.json), (d) => {
          const items = Array.isArray((d as { items?: unknown[] }).items) ? (d as { items: unknown[] }).items : [];
          return items.length === 0
            ? "No stake ledgers found"
            : items.map((item) => {
              const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
              return `${String(row["identityId"] ?? "?")}/${String(row["chainAgentId"] ?? row["agentId"] ?? "?")} ${String(row["status"] ?? "?")} active=${String(row["activeAmount"] ?? "0")} unbonding=${String(row["unbondingAmount"] ?? "0")}`;
            }).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  stake
    .command("bond")
    .description("Bond stake for an agent identity on chain")
    .requiredOption("--identity-id <id>", "Identity ID")
    .option("--agent-id <id>", "Chain agent ID (defaults to profile agentId)")
    .requiredOption("--amount <amount>", "Amount to hold")
    .option("--rpc-url <url>", "Substrate WebSocket RPC URL")
    .option("--signer-uri <uri>", "Signer URI; root or authorized agent/operator")
    .option("--chain-id <id>", "Chain ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      await runStakeTx("bond", opts);
    });

  stake
    .command("request-unbond")
    .description("Request delayed unbond for an agent")
    .requiredOption("--identity-id <id>", "Identity ID")
    .option("--agent-id <id>", "Chain agent ID (defaults to profile agentId)")
    .requiredOption("--amount <amount>", "Amount to unbond")
    .option("--rpc-url <url>", "Substrate WebSocket RPC URL")
    .option("--signer-uri <uri>", "Signer URI; root or authorized agent/operator")
    .option("--chain-id <id>", "Chain ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      await runStakeTx("request-unbond", opts);
    });

  stake
    .command("cancel-unbond")
    .description("Cancel pending unbond for an agent")
    .requiredOption("--identity-id <id>", "Identity ID")
    .option("--agent-id <id>", "Chain agent ID (defaults to profile agentId)")
    .option("--rpc-url <url>", "Substrate WebSocket RPC URL")
    .option("--signer-uri <uri>", "Signer URI; root or authorized agent/operator")
    .option("--chain-id <id>", "Chain ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      await runStakeTx("cancel-unbond", opts);
    });

  stake
    .command("release-unbond")
    .description("Release unbonded stake after unlock")
    .requiredOption("--identity-id <id>", "Identity ID")
    .option("--agent-id <id>", "Chain agent ID (defaults to profile agentId)")
    .option("--rpc-url <url>", "Substrate WebSocket RPC URL")
    .option("--signer-uri <uri>", "Signer URI; root or authorized agent/operator")
    .option("--chain-id <id>", "Chain ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      await runStakeTx("release-unbond", opts);
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

  // Chain-level identity / onboarding commands.
  registerChainIdentityCommands(agent);
  registerChainRegistrarCommands(agent);
  registerChainRegisterAgentCommands(agent);
}

async function runStakeTx(kind: "bond" | "request-unbond" | "cancel-unbond" | "release-unbond", opts: Record<string, unknown>): Promise<void> {
  try {
    const agentId = (opts["agentId"] as string | undefined) ?? requireAgentId(loadActiveProfile().profile);
    const receipt = await submitAgentStakeTx({
      kind,
      identityId: opts["identityId"] as string,
      agentId,
      amount: opts["amount"] as string | undefined,
      signer: {
        rpcUrl: opts["rpcUrl"] as string | undefined,
        signerUri: opts["signerUri"] as string | undefined,
        chainId: opts["chainId"] as string | undefined,
      },
    });
    printOutput(outputOk(receipt), Boolean(opts["json"]), () => `${kind} submitted: ${receipt.txHash}`);
  } catch (e) {
    handleCliError(e, opts["json"] as boolean | undefined);
  }
}

// ── Chain-level identity / onboarding commands ────────────────────────────────

function registerChainIdentityCommands(agent: Command): void {
  const identity = agent
    .command("identity")
    .description("Chain-level identity management (pallet_identity_core)");

  identity
    .command("register-chain")
    .description("Register a new root identity on chain (pallet_identity_core::register_identity)")
    .option("--rpc-url <url>", "Substrate WebSocket RPC URL")
    .option("--signer-uri <uri>", "Signer URI (dev account, e.g. //Alice)")
    .option("--chain-id <id>", "Chain ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const receipt = await submitIdentityOnboardingTx({
          kind: "register-identity",
          signer: {
            rpcUrl: opts.rpcUrl as string | undefined,
            signerUri: opts.signerUri as string | undefined,
            chainId: opts.chainId as string | undefined,
          },
        });
        printOutput(
          outputOk(receipt),
          Boolean(opts.json),
          () => `Identity registered on chain: identityId=${String(receipt.identityId)} txHash=${receipt.txHash}`,
        );
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}

function registerChainRegistrarCommands(agent: Command): void {
  agent
    .command("set-registrar")
    .description(
      "Authorise a registrar account for an identity (pallet_onboarding_distribution::set_agent_registrar)",
    )
    .requiredOption("--identity-id <id>", "Identity ID (0x hex H256)")
    .requiredOption("--registrar-key <key>", "AccountId (SS58 or hex) to authorise as registrar")
    .option("--rpc-url <url>", "Substrate WebSocket RPC URL")
    .option("--signer-uri <uri>", "Signer URI (must be identity owner)")
    .option("--chain-id <id>", "Chain ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const receipt = await submitIdentityOnboardingTx({
          kind: "set-agent-registrar",
          identityId: opts.identityId as string,
          registrarKey: opts.registrarKey as string,
          signer: {
            rpcUrl: opts.rpcUrl as string | undefined,
            signerUri: opts.signerUri as string | undefined,
            chainId: opts.chainId as string | undefined,
          },
        });
        printOutput(
          outputOk(receipt),
          Boolean(opts.json),
          () =>
            `Agent registrar set for identity ${String(opts.identityId)}: txHash=${receipt.txHash}`,
        );
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}

function registerChainRegisterAgentCommands(agent: Command): void {
  agent
    .command("register-chain")
    .description(
      "Register an agent on chain (pallet_onboarding_distribution::register_agent)",
    )
    .requiredOption("--identity-id <id>", "Identity ID (0x hex H256)")
    .requiredOption(
      "--agent-ref <ref>",
      'ContentRef for the agent: "hash:0x<64hex>" or "uri:<uri>"',
    )
    .option("--rpc-url <url>", "Substrate WebSocket RPC URL")
    .option("--signer-uri <uri>", "Signer URI (identity owner or authorised registrar)")
    .option("--chain-id <id>", "Chain ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const receipt = await submitIdentityOnboardingTx({
          kind: "register-agent",
          identityId: opts.identityId as string,
          agentRef: opts.agentRef as string,
          signer: {
            rpcUrl: opts.rpcUrl as string | undefined,
            signerUri: opts.signerUri as string | undefined,
            chainId: opts.chainId as string | undefined,
          },
        });
        printOutput(
          outputOk(receipt),
          Boolean(opts.json),
          () =>
            `Agent registered on chain: agentId=${String(receipt.agentId)} txHash=${receipt.txHash}`,
        );
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
