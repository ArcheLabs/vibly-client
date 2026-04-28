import type { Command } from "commander";
import { CoordinatorClient } from "../../coordinator/client.js";
import { loadActiveProfile, requireApiToken, requireProjectId } from "../../config/profiles.js";
import { openDatabase } from "../../local/database.js";
import { runMigrations } from "../../local/migrations.js";
import { LocalEntityStore } from "../../local/stores/localEntityStore.js";
import { LocalEventStore } from "../../local/stores/localEventStore.js";
import { LocalSyncStateStore } from "../../local/stores/localSyncStateStore.js";
import { getDatabasePath } from "../../config/paths.js";
import { outputOk, outputErr, printOutput } from "../../domain/apiTypes.js";
import { ClientError } from "../../domain/errors.js";

export function registerSyncCommands(program: Command): void {
  const sync = program.command("sync").description("Sync data from coordinator");

  sync
    .command("events")
    .description("Sync recent events from coordinator")
    .option("--limit <n>", "Number of events to fetch", "100")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getClient();
        const db = openDatabase(getDatabasePath());
        runMigrations(db);
        const eventStore = new LocalEventStore(db);
        const syncState = new LocalSyncStateStore(db);

        const state = syncState.get("events");
        const result = await client.listEvents({
          limit: parseInt(opts.limit as string, 10),
          from: state?.cursor ?? undefined,
        });
        eventStore.upsertMany(result.items);
        if (result.items.length > 0) {
          const cursor = result.items[result.items.length - 1].id;
          syncState.set("events", cursor);
        }

        printOutput(outputOk({ synced: result.items.length }), Boolean(opts.json), (d) =>
          `Synced ${String((d as { synced: number }).synced)} events`,
        );
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  sync
    .command("project")
    .description("Sync project state, objectives, and boundary to local storage")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getClient();
        const projectId = requireProjectId(profile);
        const db = openDatabase(getDatabasePath());
        runMigrations(db);
        const entityStore = new LocalEntityStore(db);
        const syncState = new LocalSyncStateStore(db);

        const [proj, objectives, boundary, state] = await Promise.allSettled([
          client.getProject(projectId),
          client.listObjectives(projectId),
          client.getBoundary(projectId),
          client.getLatestState(projectId),
        ]);

        if (proj.status === "fulfilled") entityStore.upsert("project", projectId, proj.value);
        if (objectives.status === "fulfilled") entityStore.upsertMany("objective", objectives.value.items as unknown as Array<{ id: string } & Record<string, unknown>>);
        if (boundary.status === "fulfilled" && boundary.value) entityStore.upsert("boundary", projectId, boundary.value);
        if (state.status === "fulfilled" && state.value) entityStore.upsert("state", projectId, state.value);
        syncState.set(`project:${projectId}`);

        printOutput(outputOk({ projectId }), Boolean(opts.json), () => `Project state synced for ${projectId}`);
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  sync
    .command("work")
    .description("Sync open work orders to local storage")
    .option("--limit <n>", "Number of work orders to fetch", "50")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getClient();
        const db = openDatabase(getDatabasePath());
        runMigrations(db);
        const entityStore = new LocalEntityStore(db);

        const projectId = profile.projectId;
        const result = await client.listOpenWorkOrders({
          projectId,
          limit: parseInt(opts.limit as string, 10),
        });
        entityStore.upsertMany("work_order", result.items as unknown as Array<{ id: string } & Record<string, unknown>>);

        printOutput(outputOk({ synced: result.items.length }), Boolean(opts.json), (d) =>
          `Synced ${String((d as { synced: number }).synced)} open work orders`,
        );
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  sync
    .command("all")
    .description("Run all sync operations")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getClient();
        const projectId = profile.projectId;
        const db = openDatabase(getDatabasePath());
        runMigrations(db);
        const entityStore = new LocalEntityStore(db);
        const eventStore = new LocalEventStore(db);
        const syncState = new LocalSyncStateStore(db);

        const results: Record<string, number> = {};

        // Events
        const state = syncState.get("events");
        const events = await client.listEvents({ limit: 200, from: state?.cursor ?? undefined });
        eventStore.upsertMany(events.items);
        results["events"] = events.items.length;
        if (events.items.length > 0) syncState.set("events", events.items[events.items.length - 1].id);

        // Work orders
        const workOrders = await client.listOpenWorkOrders({ projectId, limit: 50 });
        entityStore.upsertMany("work_order", workOrders.items as unknown as Array<{ id: string } & Record<string, unknown>>);
        results["work_orders"] = workOrders.items.length;

        // Project data
        if (projectId) {
          const [proj, objectives, boundary, latestState] = await Promise.allSettled([
            client.getProject(projectId),
            client.listObjectives(projectId),
            client.getBoundary(projectId),
            client.getLatestState(projectId),
          ]);
          if (proj.status === "fulfilled") { entityStore.upsert("project", projectId, proj.value); results["project"] = 1; }
          if (objectives.status === "fulfilled") { entityStore.upsertMany("objective", objectives.value.items as unknown as Array<{ id: string } & Record<string, unknown>>); results["objectives"] = objectives.value.items.length; }
          if (boundary.status === "fulfilled" && boundary.value) entityStore.upsert("boundary", projectId, boundary.value);
          if (latestState.status === "fulfilled" && latestState.value) entityStore.upsert("state", projectId, latestState.value);
          syncState.set(`project:${projectId}`);
        }

        printOutput(outputOk(results), Boolean(opts.json), (d) => {
          const r = d as Record<string, number>;
          return Object.entries(r).map(([k, v]) => `  ${k}: ${v}`).join("\n");
        });
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });
}

function getClient() {
  const { config, profile } = loadActiveProfile();
  const token = requireApiToken(profile);
  const client = new CoordinatorClient({ baseUrl: profile.coordinatorUrl, token });
  return { client, config, profile };
}

function handleError(e: unknown, json?: boolean): void {
  if (e instanceof ClientError) {
    printOutput(outputErr(e.code, e.message, e.hint), Boolean(json));
  } else {
    printOutput(outputErr("COORDINATOR_API_ERROR", String(e)), Boolean(json));
  }
  process.exitCode = 1;
}
