import type { Command } from "commander";
import { CoordinatorClient } from "../../coordinator/client.js";
import { loadConfig } from "../../config/config.js";
import { outputOk, outputErr, printOutput } from "../../domain/apiTypes.js";
import { ClientError } from "../../domain/errors.js";

export function registerLoginCommands(program: Command): void {
  program
    .command("login")
    .description("Authenticate with a coordinator and save profile")
    .requiredOption("--coordinator <url>", "Coordinator base URL")
    .requiredOption("--token <token>", "API token")
    .option("--profile <name>", "Profile name to save (default: default)", "default")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const client = new CoordinatorClient({
          baseUrl: opts.coordinator,
          token: opts.token,
        });
        const health = await client.health();

        const { loadConfig: lc, saveConfig: sc } = await import("../../config/config.js");
        const config = lc();
        const profileName: string = opts.profile as string;

        config.profiles[profileName] = {
          ...(config.profiles[profileName] ?? {}),
          name: profileName,
          coordinatorUrl: opts.coordinator as string,
          apiTokenRef: `env:VIBLY_API_TOKEN_${profileName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
        };
        if (!config.defaultProfile) config.defaultProfile = profileName;
        sc(config);

        // Persist token hint
        const data = { profile: profileName, coordinator: opts.coordinator as string, status: health.status };
        printOutput(outputOk(data), Boolean(opts.json), (raw) => {
          const d = raw as typeof data;
          return `Logged in to ${d.coordinator} (profile: ${d.profile}, status: ${d.status})\nNote: Store your token in the VIBLY_API_TOKEN env var or use --api-token`;
        });
      } catch (e) {
        if (e instanceof ClientError) {
          printOutput(outputErr(e.code, e.message, e.hint), Boolean(opts.json));
        } else {
          printOutput(outputErr("COORDINATOR_UNREACHABLE", String(e)), Boolean(opts.json));
        }
        process.exitCode = 1;
      }
    });

  program
    .command("logout")
    .description("Remove saved profile")
    .argument("[profile]", "Profile name (default: current)")
    .option("--json", "Output as JSON")
    .action(async (profileArg: string | undefined, opts) => {
      const config = loadConfig();
      const profileName = profileArg ?? config.defaultProfile ?? "default";
      if (!config.profiles[profileName]) {
        printOutput(outputErr("PROFILE_NOT_FOUND", `Profile '${profileName}' not found`), Boolean(opts.json));
        process.exitCode = 1;
        return;
      }
      delete config.profiles[profileName];
      if (config.defaultProfile === profileName) {
        const remaining = Object.keys(config.profiles);
        config.defaultProfile = remaining[0] ?? "default";
      }
      const { saveConfig } = await import("../../config/config.js");
      saveConfig(config);
      printOutput(outputOk({ removed: profileName }), Boolean(opts.json), (raw) => {
        const d = raw as { removed: string };
        return `Removed profile '${d.removed}'`;
      });
    });
}
