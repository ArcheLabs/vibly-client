import type { Command } from "commander";
import { requireAgentId } from "../../../config/profiles.js";
import { openDatabase } from "../../../local/database.js";
import { runMigrations } from "../../../local/migrations.js";
import { LocalEntityStore } from "../../../local/stores/localEntityStore.js";
import { LocalWorkStore } from "../../../local/stores/localWorkStore.js";
import { getDatabasePath } from "../../../config/paths.js";
import { getRuntimeByName } from "../../../runtime/runtimeRegistry.js";
import { RuntimeHost } from "../../../runtime/runtimeHost.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { ClientError, ErrorCode } from "../../../domain/errors.js";
import { randomUUID } from "node:crypto";
import type { WorkOrder } from "../../../coordinator/types.js";
import type { RuntimeExecutionInput } from "../../../domain/clientTypes.js";

import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
export function registerWorkCommands(program: Command): void {
  const work = program.command("work").description("Manage work orders");

  work
    .command("list")
    .description("List cached open work orders")
    .option("--live", "Fetch from coordinator instead of local cache")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        if (opts.live) {
          const { client, profile } = getCoordinatorClient();
          const result = await client.listOpenWorkOrders({ projectId: profile.projectId, limit: 50 });
          printWorkOrders(result.items, Boolean(opts.json));
        } else {
          const db = openDatabase(getDatabasePath());
          runMigrations(db);
          const entityStore = new LocalEntityStore(db);
          const items = entityStore.list<WorkOrder>("work_order");
          printWorkOrders(items, Boolean(opts.json));
        }
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  work
    .command("show")
    .description("Show work order details")
    .argument("<id>", "Work order ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client } = getCoordinatorClient();
        const wo = await client.getWorkOrder(id);
        printOutput(outputOk(wo), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  work
    .command("claim")
    .description("Claim a work order")
    .argument("<id>", "Work order ID")
    .option("--lease <ms>", "Lease duration in milliseconds")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const agentId = requireAgentId(profile);
        const claim = await client.claimWorkOrder(id, {
          actorId: agentId,
          leaseMs: opts.lease ? parseInt(opts.lease as string, 10) : undefined,
        });
        printOutput(outputOk(claim), Boolean(opts.json), () => `Claimed work order ${ id }`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  work
    .command("run")
    .description("Execute a work order with a local runtime")
    .argument("<id>", "Work order ID")
    .requiredOption("--runtime <name>", "Runtime name to use")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await runWorkOrder(id, opts.runtime as string);
        printOutput(outputOk({ runId: result.runId, summary: result.summary }), Boolean(opts.json), (d) => {
          const r = d as { runId: string; summary: string };
          return `Run completed: ${r.runId}\nSummary: ${r.summary}`;
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  work
    .command("submit")
    .description("Submit a completed work order")
    .argument("<id>", "Work order ID")
    .requiredOption("--context-bundle-id <id>", "Context bundle ID")
    .requiredOption("--summary <text>", "Submission summary")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const agentId = requireAgentId(profile);
        const sub = await client.submitWorkOrder(id, {
          submittedBy: agentId,
          contextBundleId: opts.contextBundleId as string,
          summary: opts.summary as string,
        });
        printOutput(outputOk(sub), Boolean(opts.json), () => `Submitted work order ${ id }`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  work
    .command("run-and-submit")
    .description("Claim, run, and submit a work order in one step")
    .argument("<id>", "Work order ID")
    .requiredOption("--runtime <name>", "Runtime name to use")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const agentId = requireAgentId(profile);

        // 1. Claim
        console.error(`Claiming work order ${ id }...`);
        await client.claimWorkOrder(id, { actorId: agentId });

        // 2. Create + accept context bundle
        console.error("Creating context bundle...");
        const bundle = await client.createContextBundle({ actorId: agentId });
        const receipt = await client.acceptContextBundle({
          contextBundleId: bundle.id,
          actorId: agentId,
        });

        // 3. Run runtime
        console.error(`Running runtime '${opts.runtime as string}'...`);
        const workOrder = await client.getWorkOrder(id);
        const runtimeConfig = getRuntimeByName(opts.runtime as string);
        if (!runtimeConfig) {
          throw new ClientError(ErrorCode.RUNTIME_NOT_FOUND, `Runtime '${opts.runtime as string}' not found`);
        }

        const runInput: RuntimeExecutionInput = {
          agentId,
          runtimeBindingId: profile.defaultRuntimeBindingId ?? "",
          workOrderId: id,
          workOrderJson: JSON.stringify(workOrder),
          contextBundleJson: JSON.stringify(bundle),
          contextReceiptJson: JSON.stringify(receipt),
          workingDirectory: "",
        };
        const host = new RuntimeHost();
        const runResult = await host.run(runtimeConfig, runInput);

        // 4. Submit
        console.error("Submitting work order...");
        const sub = await client.submitWorkOrder(id, {
          submittedBy: agentId,
          contextBundleId: bundle.id,
          executionReceipt: runResult.executionReceipt,
          summary: runResult.summary,
        });

        // 5. Save run to local DB
        const db = openDatabase(getDatabasePath());
        runMigrations(db);
        const workStore = new LocalWorkStore(db);
        const runId = randomUUID();
        workStore.createRun({
          id: runId,
          workOrderId: id,
          runtimeBindingId: runtimeConfig.runtimeBindingId,
          status: "succeeded",
          startedAt: runResult.executionReceipt.startedAt,
          input: runInput,
        });
        workStore.updateRun(runId, {
          finishedAt: runResult.executionReceipt.finishedAt,
          output: sub,
          executionReceipt: runResult.executionReceipt,
        });

        printOutput(outputOk({ submissionId: (sub as { id?: string }).id, summary: runResult.summary }), Boolean(opts.json), (d) => {
          const r = d as { submissionId?: string; summary: string };
          return `Work order submitted. Submission ID: ${r.submissionId ?? "unknown"}\nSummary: ${r.summary}`;
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}

async function runWorkOrder(workOrderId: string, runtimeName: string) {
  const { client, profile } = getCoordinatorClient();
  const agentId = requireAgentId(profile);

  const runtimeConfig = getRuntimeByName(runtimeName);
  if (!runtimeConfig) {
    throw new ClientError(ErrorCode.RUNTIME_NOT_FOUND, `Runtime '${ runtimeName }' not found`);
  }

  const workOrder = await client.getWorkOrder(workOrderId);
  const bundle = await client.createContextBundle({ actorId: agentId });
  const receipt = await client.acceptContextBundle({ contextBundleId: bundle.id, actorId: agentId });

  const runInput: RuntimeExecutionInput = {
    agentId,
    runtimeBindingId: profile.defaultRuntimeBindingId ?? "",
    workOrderId: workOrderId,
    workOrderJson: JSON.stringify(workOrder),
    contextBundleJson: JSON.stringify(bundle),
    contextReceiptJson: JSON.stringify(receipt),
    workingDirectory: "",
  };
  const host = new RuntimeHost();
  const runResult = await host.run(runtimeConfig, runInput);

  const db = openDatabase(getDatabasePath());
  runMigrations(db);
  const workStore = new LocalWorkStore(db);
  const runId = randomUUID();
  workStore.createRun({
    id: runId,
    workOrderId,
    runtimeBindingId: runtimeConfig.runtimeBindingId,
    status: "succeeded",
    startedAt: runResult.executionReceipt.startedAt,
    input: runInput,
  });

  return { runId, summary: runResult.summary };
}

function printWorkOrders(items: WorkOrder[], json: boolean): void {
  printOutput(outputOk(items), json, (data) => {
    const arr = data as WorkOrder[];
    if (arr.length === 0) return "No open work orders. Run `vibly sync work` to refresh.";
    return arr.map((w) => `  ${w.id}  ${(w as { title?: string }).title ?? ""}  (${(w as { status?: string }).status ?? ""})`).join("\n");
  });
}
