import { CoordinatorClient } from "../coordinator/client.js";
import { loadConfig, saveConfig } from "../config/config.js";
import { getActiveProfile, getNetworkProfile } from "../config/profiles.js";
import { ClientError, ErrorCode } from "../domain/errors.js";
import type { ClientConfig, ClientProfile, NetworkManifest, NetworkProfile } from "../domain/clientTypes.js";

export const DEFAULT_NETWORK_BOOTSTRAP_URL = "https://vibly.network/networks.json";

export function manifestToProfileNetwork(manifest: NetworkManifest): NetworkProfile {
  const coordinatorUrl = manifest.coordinatorUrls[0];
  if (!coordinatorUrl) {
    throw new ClientError(ErrorCode.INVALID_CONFIG, `Network ${manifest.id} has no coordinator URL.`);
  }
  return {
    id: manifest.id,
    displayName: manifest.label,
    label: manifest.label,
    stage: manifest.stage,
    status: manifest.status,
    manifestVersion: manifest.manifestVersion,
    updatedAt: manifest.updatedAt,
    ttlSeconds: manifest.ttlSeconds,
    lastSyncedAt: new Date().toISOString(),
    coordinatorUrl,
    coordinatorUrls: manifest.coordinatorUrls,
    viblyGenesisHash: manifest.chains.vibly.genesisHash,
    viblyRpcUrl: manifest.chains.vibly.rpcUrls[0],
    viblyRpcUrls: manifest.chains.vibly.rpcUrls,
    chains: manifest.chains,
    features: manifest.features,
    messages: manifest.messages,
  };
}

export async function fetchNetworkManifests(input: {
  coordinatorUrl?: string;
  token?: string;
  bootstrapUrl?: string;
  networkId?: string;
} = {}): Promise<{ networks: NetworkManifest[]; source: string }> {
  const coordinatorUrl = input.coordinatorUrl?.replace(/\/$/, "");
  if (coordinatorUrl) {
    try {
      const client = new CoordinatorClient({ baseUrl: coordinatorUrl, token: input.token ?? "", networkId: input.networkId });
      return { networks: await client.listNetworks(), source: coordinatorUrl };
    } catch {
      // fall through to static bootstrap
    }
  }

  const bootstrapUrl = input.bootstrapUrl ?? process.env["VIBLY_NETWORK_MANIFEST_URL"] ?? DEFAULT_NETWORK_BOOTSTRAP_URL;
  const response = await fetch(bootstrapUrl);
  if (!response.ok) {
    throw new ClientError(ErrorCode.COORDINATOR_UNREACHABLE, `Unable to fetch network manifest from ${bootstrapUrl}.`);
  }
  const json = await response.json() as unknown;
  const networks = parseNetworkList(json);
  return { networks, source: bootstrapUrl };
}

export async function refreshActiveProfileNetwork(input: {
  networkId?: string;
  bootstrapUrl?: string;
  token?: string;
} = {}): Promise<{ config: ClientConfig; profile: ClientProfile; network: NetworkManifest; source: string; resetDetected: boolean }> {
  const config = loadConfig();
  const profile = getActiveProfile(config);
  const current = getNetworkProfile(profile);
  const { networks, source } = await fetchNetworkManifests({
    coordinatorUrl: current.coordinatorUrl,
    token: input.token,
    bootstrapUrl: input.bootstrapUrl,
    networkId: input.networkId ?? current.id,
  });
  const targetId = input.networkId ?? current.id;
  const manifest = networks.find((item) => item.id === targetId);
  if (!manifest) {
    throw new ClientError(ErrorCode.INVALID_CONFIG, `Network ${targetId} was not found in manifest source ${source}.`);
  }
  const previousGenesis = profile.network?.viblyGenesisHash;
  const nextNetwork = manifestToProfileNetwork(manifest);
  const resetDetected = Boolean(previousGenesis && nextNetwork.viblyGenesisHash && previousGenesis !== nextNetwork.viblyGenesisHash);
  profile.network = nextNetwork;
  profile.coordinatorUrl = nextNetwork.coordinatorUrl;
  config.profiles[profile.name] = profile;
  saveConfig(config);
  return { config, profile, network: manifest, source, resetDetected };
}

export function assertNetworkFeature(profile: ClientProfile, feature: keyof NonNullable<NetworkProfile["features"]>): void {
  const network = profile.network;
  if (!network) return;
  if (network.status && network.status !== "active") {
    throw new ClientError(
      ErrorCode.INVALID_CONFIG,
      `Network ${network.id} is ${network.status}.`,
      network.messages?.[network.status] ?? "Run `vibly network status` for the latest network state.",
    );
  }
  if (network.features && network.features[feature] === false) {
    throw new ClientError(
      ErrorCode.INVALID_CONFIG,
      `Network ${network.id} has ${feature} disabled.`,
      network.messages?.[feature] ?? "Select another network or wait for this feature to launch.",
    );
  }
}

function parseNetworkList(value: unknown): NetworkManifest[] {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const candidate = Array.isArray(value)
    ? value
    : Array.isArray(record["networks"])
      ? record["networks"]
      : Array.isArray((record["data"] as Record<string, unknown> | undefined)?.["networks"])
        ? ((record["data"] as Record<string, unknown>)["networks"] as unknown[])
        : [];
  return candidate.filter(isNetworkManifest);
}

function isNetworkManifest(value: unknown): value is NetworkManifest {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : undefined;
  return Boolean(
    record &&
      typeof record["id"] === "string" &&
      typeof record["label"] === "string" &&
      Array.isArray(record["coordinatorUrls"]) &&
      record["chains"] &&
      record["features"],
  );
}
