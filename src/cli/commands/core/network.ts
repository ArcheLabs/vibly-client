import type { Command } from "commander";
import { loadConfig, saveConfig } from "../../../config/config.js";
import { getActiveProfile, getApiToken, getNetworkProfile } from "../../../config/profiles.js";
import { outputErr, outputOk, printOutput } from "../../../domain/apiTypes.js";
import { ClientError } from "../../../domain/errors.js";
import { fetchNetworkManifests, manifestToProfileNetwork, refreshActiveProfileNetwork } from "../../../network/manifest.js";

export function registerNetworkCommands(program: Command): void {
  const network = program.command("network").description("Discover and manage Vibly network manifests");

  network
    .command("list")
    .description("List networks from coordinator or bootstrap manifest")
    .option("--json", "Output as JSON")
    .option("--bootstrap <url>", "Bootstrap manifest URL")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const profile = getActiveProfile(config);
        const current = getNetworkProfile(profile);
        const result = await fetchNetworkManifests({
          coordinatorUrl: current.coordinatorUrl,
          token: getApiToken(profile),
          bootstrapUrl: opts.bootstrap as string | undefined,
          networkId: current.id,
        });
        printOutput(outputOk(result), Boolean(opts.json), (data) => {
          const rows = (data as typeof result).networks;
          return rows.map((item) => `${item.id}  ${item.status}  ${item.label}`).join("\n");
        });
      } catch (error) {
        handleNetworkError(error, Boolean(opts.json));
      }
    });

  network
    .command("refresh")
    .description("Refresh active profile network manifest")
    .option("--network <id>", "Network ID to refresh/use")
    .option("--bootstrap <url>", "Bootstrap manifest URL")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const config = loadConfig();
        const profile = getActiveProfile(config);
        const result = await refreshActiveProfileNetwork({
          networkId: opts.network as string | undefined,
          bootstrapUrl: opts.bootstrap as string | undefined,
          token: getApiToken(profile),
        });
        printOutput(outputOk(result), Boolean(opts.json), (data) => {
          const d = data as typeof result;
          return [
            `Network: ${d.network.id} (${d.network.status})`,
            `Source:  ${d.source}`,
            `Synced:  ${d.profile.network?.lastSyncedAt ?? "unknown"}`,
            d.resetDetected ? "Warning: network reset detected; relink/re-register before running this agent." : undefined,
          ].filter(Boolean).join("\n");
        });
      } catch (error) {
        handleNetworkError(error, Boolean(opts.json));
      }
    });

  network
    .command("use <networkId>")
    .description("Switch active profile to a network from the latest manifest")
    .option("--bootstrap <url>", "Bootstrap manifest URL")
    .option("--json", "Output as JSON")
    .action(async (networkId: string, opts) => {
      try {
        const config = loadConfig();
        const profile = getActiveProfile(config);
        const current = getNetworkProfile(profile);
        const result = await fetchNetworkManifests({
          coordinatorUrl: current.coordinatorUrl,
          token: getApiToken(profile),
          bootstrapUrl: opts.bootstrap as string | undefined,
          networkId,
        });
        const manifest = result.networks.find((item) => item.id === networkId);
        if (!manifest) throw new ClientError("INVALID_CONFIG", `Network ${networkId} was not found.`);
        profile.network = manifestToProfileNetwork(manifest);
        profile.coordinatorUrl = profile.network.coordinatorUrl;
        config.profiles[profile.name] = profile;
        saveConfig(config);
        printOutput(outputOk({ profile: profile.name, network: profile.network, source: result.source }), Boolean(opts.json), () => `Using network ${networkId}`);
      } catch (error) {
        handleNetworkError(error, Boolean(opts.json));
      }
    });

  network
    .command("status")
    .description("Show cached active network manifest")
    .option("--json", "Output as JSON")
    .action((opts) => {
      try {
        const config = loadConfig();
        const profile = getActiveProfile(config);
        const networkProfile = getNetworkProfile(profile);
        printOutput(outputOk({ profile: profile.name, network: profile.network ?? networkProfile }), Boolean(opts.json), (data) => JSON.stringify(data, null, 2));
      } catch (error) {
        handleNetworkError(error, Boolean(opts.json));
      }
    });
}

function handleNetworkError(error: unknown, json: boolean) {
  if (error instanceof ClientError) {
    printOutput(outputErr(error.code, error.message, error.hint), json);
  } else {
    printOutput(outputErr("COORDINATOR_UNREACHABLE", error instanceof Error ? error.message : String(error)), json);
  }
  process.exitCode = 1;
}
