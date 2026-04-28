import type { CoordinatorClient } from "../../coordinator/client.js";
import type { ClientProfile } from "../../domain/clientTypes.js";
import { openDatabase } from "../../local/database.js";
import { runMigrations } from "../../local/migrations.js";
import { LocalEventStore } from "../../local/stores/localEventStore.js";
import { LocalSyncStateStore } from "../../local/stores/localSyncStateStore.js";
import { getDatabasePath } from "../../config/paths.js";
import { getLogger } from "../../config/logger.js";

export async function syncHandler(client: CoordinatorClient, profile: ClientProfile): Promise<void> {
  const log = getLogger();
  const db = openDatabase(getDatabasePath());
  runMigrations(db);
  const eventStore = new LocalEventStore(db);
  const syncState = new LocalSyncStateStore(db);

  try {
    const state = syncState.get("events");
    const result = await client.listEvents({ limit: 200, from: state?.cursor ?? undefined });
    eventStore.upsertMany(result.items);
    if (result.items.length > 0) {
      syncState.set("events", result.items[result.items.length - 1].id);
      log.info({ count: result.items.length }, "daemon: synced events");
    }
  } catch (e) {
    log.warn({ err: String(e) }, "daemon: sync events failed");
  }

  if (profile.projectId) {
    try {
      const { LocalEntityStore } = await import("../../local/stores/localEntityStore.js");
      const entityStore = new LocalEntityStore(db);
      const workOrders = await client.listOpenWorkOrders({ projectId: profile.projectId, limit: 50 });
      entityStore.upsertMany("work_order", workOrders.items as unknown as Array<{ id: string } & Record<string, unknown>>);
    } catch (e) {
      log.warn({ err: String(e) }, "daemon: sync work orders failed");
    }
  }
}
