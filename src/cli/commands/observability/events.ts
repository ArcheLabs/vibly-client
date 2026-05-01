import type { Command } from "commander";
import { streamEvents } from "../../../coordinator/sse.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import type { EventEnvelope } from "../../../coordinator/types.js";

import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
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
        const { client } = getCoordinatorClient();
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
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  events
    .command("tail")
    .description("Stream live events via SSE")
    .option("--type <type>", "Filter display by event type")
    .option("--project-id <id>", "Stream project-specific events")
    .action(async (opts) => {
      const { client, profile } = getCoordinatorClient();
      const projectId = (opts.projectId as string | undefined) ?? profile.projectId;
      const url = client.getStreamUrl(projectId);
      const token = client.getAuthToken();
      const controller = new AbortController();

      process.on("SIGINT", () => { controller.abort(); });
      process.on("SIGTERM", () => { controller.abort(); });

      console.log(`Streaming events from ${ url }...`);

      for await (const event of streamEvents({ url, token, signal: controller.signal })) {
        if (opts.type && event.type !== opts.type) continue;
        console.log(`[${event.timestamp}] ${event.type} ${event.id}`);
      }
    });
}
