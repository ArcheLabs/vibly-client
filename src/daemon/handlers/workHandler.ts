import type { CoordinatorClient } from "../../coordinator/client.js";
import type { ClientProfile } from "../../domain/clientTypes.js";
import type { DaemonConfig } from "../../schemas/daemon.js";
import { openDatabase } from "../../local/database.js";
import { runMigrations } from "../../local/migrations.js";
import { LocalEntityStore } from "../../local/stores/localEntityStore.js";
import { LocalWorkStore } from "../../local/stores/localWorkStore.js";
import { getDatabasePath } from "../../config/paths.js";
import { getRuntimeByName } from "../../runtime/runtimeRegistry.js";
import { RuntimeHost } from "../../runtime/runtimeHost.js";
import { getLogger } from "../../config/logger.js";
import { ClientError, ErrorCode } from "../../domain/errors.js";
import { randomUUID } from "node:crypto";
import type { WorkOrder } from "../../coordinator/types.js";

export async function workHandler(
  client: CoordinatorClient,
  profile: ClientProfile,
  daemonConfig: DaemonConfig,
): Promise<void> {
  const log = getLogger();
  if (!daemonConfig.autoClaim && !daemonConfig.autoRun && !daemonConfig.autoSubmit) return;

  const agentId = profile.agentId;
  if (!agentId) {
    log.debug("daemon: workHandler skipped — no agentId in profile");
    return;
  }

  const db = openDatabase(getDatabasePath());
  runMigrations(db);
  const entityStore = new LocalEntityStore(db);
  const workStore = new LocalWorkStore(db);

  const workOrders = entityStore.list<WorkOrder>("work_order");
  if (workOrders.length === 0) {
    log.debug("daemon: no work orders in local cache");
    return;
  }

  const openOrders = workOrders.filter((w) => {
    const status = (w as { status?: string }).status;
    return status === "open" || status === "unclaimed";
  });

  if (openOrders.length === 0) return;

  const wo = openOrders[0];

  try {
    // Check risk level
    const riskLevel = (wo as { riskLevel?: string }).riskLevel ?? "low";
    if (riskLevel === "high" || riskLevel === "critical") {
      log.warn({ workOrderId: wo.id, riskLevel }, "daemon: skipping high/critical risk work order");
      return;
    }

    if (daemonConfig.autoClaim) {
      log.info({ workOrderId: wo.id }, "daemon: claiming work order");
      await client.claimWorkOrder(wo.id, { actorId: agentId });
    }

    if (daemonConfig.autoRun && profile.defaultRuntimeBindingId) {
      const runtimeName = "default";
      const runtimeConfig = getRuntimeByName(runtimeName);
      if (!runtimeConfig) {
        log.warn({ runtimeName }, "daemon: default runtime not found, skipping autoRun");
        return;
      }

      log.info({ workOrderId: wo.id, runtimeName }, "daemon: running work order");
      const bundle = await client.createContextBundle({ actorId: agentId });
      const receipt = await client.acceptContextBundle({ contextBundleId: bundle.id, actorId: agentId });

      const host = new RuntimeHost();
      const runResult = await host.run(runtimeConfig, {
        agentId,
        runtimeBindingId: profile.defaultRuntimeBindingId ?? "",
        workOrderId: wo.id,
        workOrderJson: JSON.stringify(wo),
        contextBundleJson: JSON.stringify(bundle),
        contextReceiptJson: JSON.stringify(receipt),
        workingDirectory: "",
      });

      const runId = randomUUID();
      workStore.createRun({
        id: runId,
        workOrderId: wo.id,
        runtimeBindingId: runtimeConfig.runtimeBindingId,
        status: "succeeded",
        startedAt: runResult.executionReceipt.startedAt,
        input: wo,
      });

      if (daemonConfig.autoSubmit) {
        log.info({ workOrderId: wo.id }, "daemon: submitting work order");
        await client.submitWorkOrder(wo.id, {
          submittedBy: agentId,
          contextBundleId: bundle.id,
          executionReceipt: runResult.executionReceipt,
          summary: runResult.summary,
        });
        workStore.updateRun(runId, {
          finishedAt: runResult.executionReceipt.finishedAt,
          executionReceipt: runResult.executionReceipt,
          status: "succeeded",
        });
      }
    }
  } catch (e) {
    log.error({ err: String(e), workOrderId: wo.id }, "daemon: workHandler error");
  }
}
