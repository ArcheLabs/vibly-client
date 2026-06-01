import type { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { execa } from "execa";
import { getClientLogPath } from "../../../config/paths.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";

export function registerLogsCommands(program: Command): void {
  program
    .command("logs")
    .description("Show local daemon/client logs")
    .option("--follow", "Follow the log file")
    .option("--lines <n>", "Number of recent lines", "100")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const path = getClientLogPath();
      if (opts.follow) {
        await execa("tail", ["-n", String(opts.lines ?? "100"), "-f", path], { stdio: "inherit" });
        return;
      }
      const lines = existsSync(path)
        ? readFileSync(path, "utf8").split("\n").filter(Boolean).slice(-Number.parseInt(opts.lines as string, 10))
        : [];
      printOutput(outputOk({ path, lines }), Boolean(opts.json), () => lines.length ? lines.join("\n") : `No logs found at ${path}`);
    });
}
