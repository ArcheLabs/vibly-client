import { Command } from "commander";
import { registerCommands } from "./commands/index.js";

export function buildCli(): Command {
  const program = new Command();

  program
    .name("vibly")
    .description("Vibly Agent Node CLI")
    .version("0.1.0")
    .option("--profile <name>", "Profile to use")
    .option("--config <path>", "Config file path")
    .option("--verbose", "Verbose logging")
    .option("--coordinator-url <url>", "Override coordinator URL")
    .option("--api-token <token>", "Override API token")
    .hook("preAction", (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.profile) process.env["VIBLY_PROFILE"] = opts.profile;
      if (opts.coordinatorUrl) process.env["VIBLY_COORDINATOR_URL_OVERRIDE"] = opts.coordinatorUrl;
      if (opts.apiToken) process.env["VIBLY_API_TOKEN"] = opts.apiToken;
    });

  registerCommands(program);

  return program;
}
