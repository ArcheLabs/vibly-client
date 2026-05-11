/**
 * vibly governance — on-chain OpenGov commands.
 *
 * These commands talk DIRECTLY to the chain via PAPI.
 * They are intentionally separate from `vibly vote` (negotiation vote).
 *
 * Commands:
 *   vibly governance merged                        – read merged governance view via coordinator
 *   vibly governance subjects                      – read typed subjects via coordinator
 *   vibly governance checkpoint                    – read index checkpoint via coordinator
 *   vibly governance list                          – list open referenda via SubQuery
 *   vibly governance show <referendumIndex>        – show a single referendum
 *   vibly governance vote <referendumIndex>        – cast an on-chain vote
 *   vibly governance delegate <delegatee>          – delegate conviction votes
 *   vibly governance undelegate                    – remove delegation
 *   vibly governance unlock [referendumIndex]      – unlock/reclaim balance
 */

import { Command } from "commander";
import { resolveChainSignerOptions } from "../../../chain/signer.js";
import { getEnv } from "../../../config/env.js";
import { getCoordinatorClient } from "../shared/client.js";
import { asRecord } from "../shared/format.js";

// Lazy-import the adapter so it is only resolved when a governance sub-command
// is actually invoked (avoids pulling in polkadot-api for all CLI paths).
async function getAdapter(opts: {
  rpcUrl?: string;
  signerUri?: string;
  chainId?: string;
}) {
  const { SubstrateGovernanceActionsAdapter } = await import(
    "@concord/adapter-substrate-actions"
  );
  const options = resolveChainSignerOptions(opts);
  // signer is not passed — adapter operates without signing (prepareVote/prepareProposal only)
  return { adapter: new SubstrateGovernanceActionsAdapter({ rpcUrl: options.rpcUrl, chainId: options.chainId }), options };
}

async function getIndexerQuery(opts: { indexerUrl?: string; chainId?: string }) {
  const { SubQueryGovernanceIndexAdapter } = await import(
    "@concord/adapter-substrate-indexer"
  );
  const url =
    opts.indexerUrl ??
    getEnv("VIBLY_INDEXER_URL") ??
    "http://localhost:3010/graphql";
  const adapter = new SubQueryGovernanceIndexAdapter(url);
  const chainId = opts.chainId ?? getEnv("VIBLY_CHAIN_ID") ?? "substrate:vibly-solo";
  const chain = { namespace: "substrate" as const, chainId };
  return { query: adapter.query, chain };
}

// ─── Register ────────────────────────────────────────────────────────────────

export function registerGovernanceCommands(program: Command): void {
  const gov = program
    .command("governance")
    .description("Governance read commands and direct on-chain OpenGov actions");

  // ── coordinator read: merged ───────────────────────────────────────────────
  gov
    .command("merged")
    .description("List merged governance views from the coordinator")
    .option("--project-id <id>", "Project id (defaults to active profile project)")
    .option("--backend <kind>", "Filter by governance backend, e.g. evm-governor")
    .option("--limit <n>", "Max results", "20")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await client.listGovernanceMerged({
          projectId: opts.projectId ?? profile.projectId,
          backend: opts.backend,
          limit: Number(opts.limit),
        });
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(result, jsonReplacer, 2) + "\n");
        } else {
          printMergedItems(result.items);
        }
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  // ── coordinator read: subjects ─────────────────────────────────────────────
  gov
    .command("subjects")
    .description("List governance subjects from the coordinator")
    .option("--backend <kind>", "Filter by governance backend, e.g. evm-governor")
    .option("--chain-id <id>", "Filter by chain id")
    .option("--status <status>", "Filter by governance status")
    .option("--limit <n>", "Max results", "20")
    .action(async (opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.listGovernanceSubjects({
          backend: opts.backend,
          chainId: opts.chainId,
          status: opts.status,
          limit: Number(opts.limit),
        });
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(result, jsonReplacer, 2) + "\n");
        } else {
          printSubjectItems(result.items);
        }
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  // ── coordinator read: checkpoint ───────────────────────────────────────────
  gov
    .command("checkpoint")
    .description("Show governance index checkpoint from the coordinator")
    .option("--backend <kind>", "Filter by governance backend, e.g. evm-governor")
    .option("--chain-id <id>", "Filter by chain id")
    .action(async (opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.getGovernanceCheckpoint({
          backend: opts.backend,
          chainId: opts.chainId,
        });
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(result, jsonReplacer, 2) + "\n");
        } else {
          printCheckpoint(result.checkpoint);
        }
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  gov
    .command("backends")
    .description("List governance backend descriptors from the coordinator")
    .action(async () => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.listGovernanceBackends();
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(result, jsonReplacer, 2) + "\n");
        } else {
          printBackendItems(result.items);
        }
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  gov
    .command("submit-opengov <governanceIntentId>")
    .description("Submit a governance intent through coordinator-managed Substrate OpenGov action path")
    .requiredOption("--actor <account>", "Submitting account")
    .option("--external-id <id>", "Known referendum index for explicit receipt link")
    .option("--subject-id <id>", "Known coordinator subject id for explicit link")
    .option("--submit-args-json <json>", "Raw referenda.submit args JSON")
    .action(async (governanceIntentId: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = profile.principalId ?? opts.actor;
        const result = await client.submitActionIntent({
          type: "SubmitGovernanceOpenGov",
          principalId,
          payload: {
            governanceIntentId,
            actor: opts.actor,
            externalId: opts.externalId,
            subjectId: opts.subjectId,
            submitArgs: opts.submitArgsJson ? JSON.parse(opts.submitArgsJson) : undefined,
          },
        });
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(result, jsonReplacer, 2) + "\n");
        } else {
          process.stdout.write(`OpenGov submit intent accepted (eventId: ${result.eventId})\n`);
        }
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  gov
    .command("reconcile <governanceIntentId>")
    .description("Link a submitted governance intent to an indexed OpenGov subject")
    .option("--external-id <id>", "Referendum index")
    .option("--subject-id <id>", "Coordinator subject id")
    .action(async (governanceIntentId: string, opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.reconcileGovernanceSubject(governanceIntentId, {
          externalId: opts.externalId,
          subjectId: opts.subjectId,
        });
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(result, jsonReplacer, 2) + "\n");
        } else {
          const record = asRecord(result);
          const link = asRecord(record["link"]);
          process.stdout.write(`Intent linked to subject: ${String(link["subjectId"] ?? "-")}\n`);
        }
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  gov
    .command("vote-opengov <subjectId>")
    .description("Submit an OpenGov vote through the coordinator and observe readback through merged views")
    .requiredOption("--voter <account>", "Voting account")
    .requiredOption("--stance <stance>", "Vote stance: aye | nay | abstain | split")
    .option("--weight <planck>", "Vote balance in planck")
    .option("--conviction <0-6>", "Conviction multiplier", "0")
    .action(async (subjectId: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = profile.principalId ?? opts.voter;
        const result = await client.submitActionIntent({
          type: "SubmitGovernanceVoteOpenGov",
          principalId,
          payload: {
            subjectId,
            voter: opts.voter,
            stance: opts.stance,
            weight: opts.weight,
            conviction: opts.conviction,
          },
        });
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(result, jsonReplacer, 2) + "\n");
        } else {
          process.stdout.write(`OpenGov vote intent accepted (eventId: ${result.eventId})\n`);
        }
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  // ── list ──────────────────────────────────────────────────────────────────
  gov
    .command("list")
    .description("List open referenda from the SubQuery indexer")
    .option("--indexer-url <url>", "SubQuery GraphQL endpoint")
    .option("--chain-id <id>", "Chain identifier")
    .option("--limit <n>", "Max results", "20")
    .option("--cursor <cursor>", "Pagination cursor")
    .action(async (opts) => {
      try {
        const { query, chain } = await getIndexerQuery({
          indexerUrl: opts.indexerUrl,
          chainId: opts.chainId,
        });
        const result = await query.listGovernanceSubjects({
          chain,
          limit: Number(opts.limit),
          cursor: opts.cursor,
        });
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(result, jsonReplacer, 2) + "\n");
        } else {
          if (result.items.length === 0) {
            process.stdout.write("No referenda found.\n");
          } else {
            for (const item of result.items) {
              const idx = item.metadata?.["referendumIndex"] ?? item.ref.externalId;
              process.stdout.write(
                `#${ idx }  [${item.status}]  ${item.title ?? "(no title)"}\n`,
              );
            }
            if (result.nextCursor) {
              process.stdout.write(`\nNext cursor: ${result.nextCursor}\n`);
            }
          }
        }
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  // ── show ──────────────────────────────────────────────────────────────────
  gov
    .command("show <referendumIndex>")
    .description("Show details of a single referendum")
    .option("--indexer-url <url>", "SubQuery GraphQL endpoint")
    .option("--chain-id <id>", "Chain identifier")
    .action(async (referendumIndex: string, opts) => {
      try {
        const { query, chain } = await getIndexerQuery({
          indexerUrl: opts.indexerUrl,
          chainId: opts.chainId,
        });
        const result = await query.getGovernanceState({
          chain,
          ref: {
            chain,
            backend: "substrate-opengov",
            externalId: referendumIndex,
          },
        });
        if (!result) {
          process.stderr.write(`Referendum #${ referendumIndex } not found.\n`);
          process.exit(1);
        }
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(result, jsonReplacer, 2) + "\n");
        } else {
          process.stdout.write(`Referendum #${ referendumIndex }\n`);
          process.stdout.write(`  Status : ${result.status}\n`);
          process.stdout.write(`  Title  : ${result.title ?? "(none)"}\n`);
          if (result.metadata) {
            const m = result.metadata;
            process.stdout.write(`  Track  : ${m["track"] ?? "-"}\n`);
            process.stdout.write(`  Ayes   : ${m["ayeVotes"] ?? "-"}\n`);
            process.stdout.write(`  Nays   : ${m["nayVotes"] ?? "-"}\n`);
          }
        }
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  // ── vote ──────────────────────────────────────────────────────────────────
  gov
    .command("vote <referendumIndex>")
    .description("Cast an on-chain conviction vote on a referendum")
    .requiredOption(
      "--stance <stance>",
      "Vote stance: aye | nay | abstain | split",
    )
    .option("--conviction <0-6>", "Conviction multiplier (0=no lock)", "0")
    .option("--balance <planck>", "Vote balance in planck (default: 1 UNIT)")
    .option("--rpc-url <url>", "Substrate WS RPC URL")
    .option("--signer-uri <uri>", "Dev account URI or hex key (default: //Alice)")
    .option("--chain-id <id>", "Chain identifier")
    .action(async (referendumIndex: string, opts) => {
      try {
        const { adapter, options } = await getAdapter({
          rpcUrl: opts.rpcUrl,
          signerUri: opts.signerUri,
          chainId: opts.chainId,
        });
        const chain = { namespace: "substrate" as const, chainId: options.chainId };
        const subject = {
          chain,
          backend: "substrate-opengov" as const,
          externalId: referendumIndex,
        };
        const { payload } = await adapter.prepareVote({
          subject,
          voter: options.signerUri,
          stance: opts.stance,
          weight: opts.balance,
          metadata: { conviction: opts.conviction },
        });
        process.stderr.write(
          `Casting vote on referendum #${ referendumIndex } (stance=${opts.stance}, conviction=${opts.conviction})…\n`,
        );
        const receipt = await adapter.castVote({ subject, voter: options.signerUri, payload });
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(receipt, jsonReplacer, 2) + "\n");
        } else {
          process.stdout.write(`Vote submitted: ${receipt.txHash}\n`);
        }
        await adapter.destroy?.();
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  // ── delegate ──────────────────────────────────────────────────────────────
  gov
    .command("delegate <delegatee>")
    .description("Delegate conviction votes to another account")
    .option("--track <n>", "Track (class) to delegate (default: 0)", "0")
    .option("--conviction <0-6>", "Conviction multiplier", "1")
    .option("--balance <planck>", "Delegated balance in planck")
    .option("--rpc-url <url>", "Substrate WS RPC URL")
    .option("--signer-uri <uri>", "Dev account URI or hex key")
    .option("--chain-id <id>", "Chain identifier")
    .action(async (delegatee: string, opts) => {
      try {
        const { adapter, options } = await getAdapter({
          rpcUrl: opts.rpcUrl,
          signerUri: opts.signerUri,
          chainId: opts.chainId,
        });
        const chain = { namespace: "substrate" as const, chainId: options.chainId };
        process.stderr.write(`Delegating to ${ delegatee } on track ${opts.track}…\n`);
        const receipt = await adapter.delegate({
          chain,
          delegator: options.signerUri,
          delegatee,
          scope: opts.track,
          conviction: opts.conviction,
          metadata: opts.balance ? { balance: opts.balance } : undefined,
        });
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(receipt, jsonReplacer, 2) + "\n");
        } else {
          process.stdout.write(`Delegation submitted: ${receipt.txHash}\n`);
        }
        await adapter.destroy?.();
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  // ── undelegate ────────────────────────────────────────────────────────────
  gov
    .command("undelegate")
    .description("Remove conviction vote delegation")
    .option("--track <n>", "Track (class) to undelegate (default: 0)", "0")
    .option("--rpc-url <url>", "Substrate WS RPC URL")
    .option("--signer-uri <uri>", "Dev account URI or hex key")
    .option("--chain-id <id>", "Chain identifier")
    .action(async (opts) => {
      try {
        const { adapter, options } = await getAdapter({
          rpcUrl: opts.rpcUrl,
          signerUri: opts.signerUri,
          chainId: opts.chainId,
        });
        const chain = { namespace: "substrate" as const, chainId: options.chainId };
        process.stderr.write(`Undelegating track ${opts.track}…\n`);
        const receipt = await adapter.undelegate({ chain, delegator: options.signerUri, scope: opts.track });
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(receipt, jsonReplacer, 2) + "\n");
        } else {
          process.stdout.write(`Undelegation submitted: ${receipt.txHash}\n`);
        }
        await adapter.destroy?.();
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });

  // ── unlock ────────────────────────────────────────────────────────────────
  gov
    .command("unlock [referendumIndex]")
    .description("Unlock balance locked by a conviction vote (or remove vote)")
    .option("--rpc-url <url>", "Substrate WS RPC URL")
    .option("--signer-uri <uri>", "Dev account URI or hex key")
    .option("--chain-id <id>", "Chain identifier")
    .action(async (referendumIndex: string | undefined, opts) => {
      try {
        const { adapter, options } = await getAdapter({
          rpcUrl: opts.rpcUrl,
          signerUri: opts.signerUri,
          chainId: opts.chainId,
        });
        const chain = { namespace: "substrate" as const, chainId: options.chainId };
        const subject = referendumIndex
          ? { chain, backend: "substrate-opengov" as const, externalId: referendumIndex }
          : undefined;
        process.stderr.write(`Unlocking balance${referendumIndex ? ` (referendum #${ referendumIndex })` : ""}…\n`);
        const receipt = await adapter.unlockOrReclaim!({ chain, actor: options.signerUri, subject });
        if (program.opts().json) {
          process.stdout.write(JSON.stringify(receipt, jsonReplacer, 2) + "\n");
        } else {
          process.stdout.write(`Unlock submitted: ${receipt.txHash}\n`);
        }
        await adapter.destroy?.();
      } catch (err) {
        process.stderr.write(`Error: ${String(err)}\n`);
        process.exit(1);
      }
    });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

function printMergedItems(items: unknown[]): void {
  if (items.length === 0) {
    process.stdout.write("No merged governance views found.\n");
    return;
  }
  for (const item of items) {
    const record = asRecord(item);
    const subject = asRecord(record["subject"]);
    const status = asRecord(record["status"]);
    const freshness = asRecord(record["freshness"]);
    const readback = asRecord(record["readback"]);
    const title = String(asRecord(record["intent"])["title"] ?? subject["title"] ?? "(untitled)");
    const checkpoint = asRecord(freshness["checkpoint"]);
    process.stdout.write(
      `${String(record["id"] ?? "unknown")}  [${String(status["merged"] ?? "unknown")}]  ${String(subject["backend"] ?? "-")}  ${ title }`,
    );
    if (freshness["stale"]) {
      process.stdout.write(`  stale${freshness["reason"] ? `:${String(freshness["reason"])}` : ""}`);
    }
    if (readback["pending"]) process.stdout.write("  pending-indexer");
    if (readback["submitTxHash"]) process.stdout.write(`  tx=${String(readback["submitTxHash"])}`);
    if (readback["voteReadbackStatus"]) process.stdout.write(`  votes=${String(readback["voteReadbackStatus"])}`);
    if (checkpoint["observedAt"]) process.stdout.write(`  observed=${String(checkpoint["observedAt"])}`);
    process.stdout.write("\n");
  }
}

function printSubjectItems(items: unknown[]): void {
  if (items.length === 0) {
    process.stdout.write("No governance subjects found.\n");
    return;
  }
  for (const item of items) {
    const record = asRecord(item);
    process.stdout.write(
      `${String(record["id"] ?? record["externalId"] ?? "unknown")}  [${String(record["status"] ?? "unknown")}]  ${String(record["backend"] ?? "-")}  ${String(record["title"] ?? "(untitled)")}\n`,
    );
  }
}

function printCheckpoint(checkpoint: unknown): void {
  if (!checkpoint) {
    process.stdout.write("No governance checkpoint found.\n");
    return;
  }
  const record = asRecord(checkpoint);
  const chain = asRecord(record["chain"]);
  const cursor = asRecord(record["cursor"]);
  process.stdout.write(`Checkpoint ${String(record["id"] ?? "-")}\n`);
  process.stdout.write(`  Chain      : ${String(chain["namespace"] ?? "-")}:${String(chain["chainId"] ?? "-")}\n`);
  process.stdout.write(`  Block      : ${String(cursor["blockNumber"] ?? "-")}\n`);
  process.stdout.write(`  Finalized  : ${String(record["finalized"] ?? false)}\n`);
  process.stdout.write(`  Observed at: ${String(record["observedAt"] ?? "-")}\n`);
}

function printBackendItems(items: unknown[]): void {
  if (items.length === 0) {
    process.stdout.write("No governance backends registered.\n");
    return;
  }
  for (const item of items) {
    const record = asRecord(item);
    const capabilities = asRecord(record["capabilities"]);
    const health = asRecord(record["health"]);
    const chain = asRecord(record["chain"]);
    const write = Boolean(
      capabilities["castVote"] ||
        capabilities["delegate"] ||
        capabilities["queueExecution"] ||
        capabilities["executeProposal"],
    );
    process.stdout.write(
      `${String(record["id"] ?? "unknown")}  ${String(record["backend"] ?? "-")}  ${String(chain["namespace"] ?? "-")}:${String(chain["chainId"] ?? "-")}  ${write ? "actions" : "read-only"}  ${String(health["status"] ?? "unknown")}`,
    );
    if (health["reason"]) process.stdout.write(`:${String(health["reason"])}`);
    if (health["lastObservedAt"]) process.stdout.write(`  observed=${String(health["lastObservedAt"])}`);
    process.stdout.write("\n");
  }
}

