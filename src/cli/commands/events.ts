import type { Command } from "commander";
import { CoordinatorClient } from "../../coordinator/client.js";
import { loadActiveProfile, requireApiToken } from "../../config/profiles.js";
import { streamEvents } from "../../coordinator/sse.js";
import { outputOk, outputErr, printOutput } from "../../domain/apiTypes.js";
import { ClientError } from "../../domain/errors.js";
import type { EventEnvelope } from "../../coordinator/types.js";

export function registerEventCommands(program: Command): void {
  const events = program.command("events").description("Browse events");

  events
    .command("list")
    .description("List recent events from the coordinator")
    .option("--type <type>", "Filter by event type")
    .option("--limit <n>", "Number of events", "20")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getClient();
        const result = await client.listEvents({
          type: opts.type as string | undefined,
          limit: parseInt(opts.limit as string, 10),
        });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as EventEnvelope[];
          if (arr.length === 0) return "No events";
          return arr.map((e) => `  ${e.timestamp}  ${e.type}  ${e.id}`).join("\n");
        });
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  events
    .command("tail")
    .description("Stream live events via SSE")
    .option("--type <type>", "Filter display by event type")
    .option("--project-id <id>", "Stream project-specific events")
    .action(async (opts) => {
      const { client, profile } = getClient();
      const projectId = (opts.projectId as string | undefined) ?? profile.projectId;
      const url = client.getStreamUrl(projectId);
      const token = client.getAuthToken();
      const controller = new AbortController();

      process.on("SIGINT", () => { controller.abort(); });
      process.on("SIGTERM", () => { controller.abort(); });

      console.log(`Streaming events from ${url}...`);

      for await (const event of streamEvents({ url, token, signal: controller.signal })) {
        if (opts.type && event.type !== opts.type) continue;
        console.log(`[${event.timestamp}] ${event.type} ${event.id}`);
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
