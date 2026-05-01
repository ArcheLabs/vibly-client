import { Command } from "commander";
import { loadConfig, saveConfig, initConfig, setConfigKey } from "../../../config/config.js";
import {
  listProfiles,
  createProfile,
  setDefaultProfile,
  getActiveProfileName,
} from "../../../config/profiles.js";
import { outputOk, outputErr, printOutput } from "../../../domain/apiTypes.js";
import { ClientError } from "../../../domain/errors.js";

export function registerConfigCommands(program: Command): void {
  const config = program
    .command("config")
    .description("Manage vibly client configuration");

  config
    .command("init")
    .description("Initialize configuration with defaults")
    .option("--json", "Output as JSON")
    .action((opts) => {
      try {
        const cfg = initConfig();
        printOutput(outputOk({ message: "Config initialized", config: cfg }), !!opts.json);
      } catch (e) {
        handleError(e, !!opts.json);
      }
    });

  config
    .command("show")
    .description("Show current configuration")
    .option("--json", "Output as JSON")
    .action((opts) => {
      try {
        const cfg = loadConfig();
        printOutput(outputOk(cfg), !!opts.json);
      } catch (e) {
        handleError(e, !!opts.json);
      }
    });

  config
    .command("set <key> <value>")
    .description("Set a configuration key (e.g. config set coordinatorUrl http://...)")
    .option("--profile <name>", "Target profile")
    .option("--json", "Output as JSON")
    .action((key, value, opts) => {
      try {
        const cfg = loadConfig();
        const profileName = opts.profile ?? getActiveProfileName(cfg);
        const fullKey = `profiles.${ profileName }.${ key }`;
        setConfigKey(cfg, fullKey, value);
        saveConfig(cfg);
        printOutput(outputOk({ key: fullKey, value }), !!opts.json);
      } catch (e) {
        handleError(e, !!opts.json);
      }
    });

  // vibly profile ...
  const profile = program
    .command("profile")
    .description("Manage connection profiles");

  profile
    .command("list")
    .description("List all profiles")
    .option("--json", "Output as JSON")
    .action((opts) => {
      try {
        const cfg = loadConfig();
        const active = getActiveProfileName(cfg);
        const profiles = listProfiles(cfg).map((p) => ({
          ...p,
          active: p.name === active,
        }));
        printOutput(outputOk(profiles), !!opts.json, (d) => {
          return (d as typeof profiles)
            .map((p) => `${p.active ? "*" : " "} ${p.name}  ${p.coordinatorUrl}`)
            .join("\n");
        });
      } catch (e) {
        handleError(e, !!opts.json);
      }
    });

  profile
    .command("show")
    .description("Show active profile")
    .option("--json", "Output as JSON")
    .action((opts) => {
      try {
        const cfg = loadConfig();
        const active = getActiveProfileName(cfg);
        const p = cfg.profiles[active];
        if (!p) {
          printOutput(outputErr("PROFILE_NOT_FOUND", `Profile "${ active }" not found`), !!opts.json);
          process.exitCode = 1;
          return;
        }
        printOutput(outputOk(p), !!opts.json);
      } catch (e) {
        handleError(e, !!opts.json);
      }
    });

  profile
    .command("create <name>")
    .description("Create a new profile")
    .option("--coordinator <url>", "Coordinator URL")
    .option("--json", "Output as JSON")
    .action((name, opts) => {
      try {
        const cfg = loadConfig();
        const p = createProfile(cfg, name, opts.coordinator);
        printOutput(outputOk({ message: `Profile "${ name }" created`, profile: p }), !!opts.json);
      } catch (e) {
        handleError(e, !!opts.json);
      }
    });

  profile
    .command("use <name>")
    .description("Set active profile")
    .option("--json", "Output as JSON")
    .action((name, opts) => {
      try {
        const cfg = loadConfig();
        setDefaultProfile(cfg, name);
        printOutput(outputOk({ message: `Active profile set to "${ name }"` }), !!opts.json);
      } catch (e) {
        handleError(e, !!opts.json);
      }
    });
}

function handleError(e: unknown, json: boolean): void {
  if (e instanceof ClientError) {
    printOutput(outputErr(e.code, e.message, e.hint), json);
  } else {
    printOutput(outputErr("UNKNOWN_ERROR", String(e)), json);
  }
  process.exitCode = 1;
}
