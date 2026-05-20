import type { ClientConfig, ClientProfile } from "../domain/clientTypes.js";
import { ClientError, ErrorCode } from "../domain/errors.js";
import { loadConfig, saveConfig } from "./config.js";
import { resolveToken } from "./env.js";
import { getViblyhome } from "./paths.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function getActiveProfileName(config: ClientConfig): string {
  return process.env["VIBLY_PROFILE"] ?? config.defaultProfile ?? "default";
}

export function getActiveProfile(config: ClientConfig): ClientProfile {
  const name = getActiveProfileName(config);
  const profile = config.profiles[name];
  if (!profile) {
    throw new ClientError(
      ErrorCode.PROFILE_NOT_FOUND,
      `Profile "${name}" not found.`,
      `Run \`vibly profile list\` to see available profiles, or \`vibly profile create ${name}\`.`,
    );
  }
  return profile;
}

export function getApiToken(profile: ClientProfile): string | undefined {
  return resolveToken(profile.apiTokenRef) ?? process.env["VIBLY_API_TOKEN"];
}

export function getNetworkProfile(profile: ClientProfile) {
  const networkId = process.env["VIBLY_NETWORK_ID"] ?? profile.network?.id ?? "substrate:vibly-solo";
  const coordinatorUrl = process.env["COORDINATOR_URL"] ?? profile.network?.coordinatorUrl ?? profile.coordinatorUrl;
  return {
    id: networkId,
    displayName: profile.network?.displayName ?? networkId,
    stage: profile.network?.stage ?? "local",
    coordinatorUrl,
    viblyGenesisHash: process.env["VIBLY_GENESIS_HASH"] ?? profile.network?.viblyGenesisHash,
    relayRpcUrl: process.env["RELAY_RPC_URL"] ?? profile.network?.relayRpcUrl,
    viblyRpcUrl: process.env["VIBLY_RPC_URL"] ?? profile.network?.viblyRpcUrl,
  };
}

export function assertProfileNetworkState(profile: ClientProfile): void {
  const network = getNetworkProfile(profile);
  const statePath = join(getViblyhome(), "network-state.json");
  const next = {
    profileName: profile.name,
    agentId: profile.agentId,
    identityId: profile.principalId,
    networkId: network.id,
    viblyGenesisHash: network.viblyGenesisHash,
    coordinatorUrl: network.coordinatorUrl,
  };
  mkdirSync(getViblyhome(), { recursive: true });
  if (!existsSync(statePath)) {
    writeFileSync(statePath, JSON.stringify(next, null, 2) + "\n");
    return;
  }
  const current = JSON.parse(readFileSync(statePath, "utf8")) as typeof next;
  const sameIdentity = current.agentId === next.agentId && current.identityId === next.identityId;
  const sameNetwork =
    current.networkId === next.networkId &&
    current.viblyGenesisHash === next.viblyGenesisHash &&
    current.coordinatorUrl === next.coordinatorUrl;
  if (sameIdentity && !sameNetwork) {
    throw new ClientError(
      ErrorCode.INVALID_CONFIG,
      "Configured agent identity belongs to a different network profile.",
      `Use a separate VIBLY_HOME or explicitly migrate the identity before switching from ${current.networkId} to ${next.networkId}.`,
    );
  }
  writeFileSync(statePath, JSON.stringify(next, null, 2) + "\n");
}

export function requireApiToken(profile: ClientProfile): string {
  const t = getApiToken(profile);
  if (!t) {
    throw new ClientError(
      ErrorCode.UNAUTHORIZED,
      "No API token configured.",
      "Run `vibly login --token <token>` or set VIBLY_API_TOKEN.",
    );
  }
  return t;
}

export function requirePrincipalId(profile: ClientProfile): string {
  if (!profile.principalId) {
    throw new ClientError(
      ErrorCode.PRINCIPAL_NOT_CONFIGURED,
      "No principal configured in this profile.",
      "Run `vibly principal register` first.",
    );
  }
  return profile.principalId;
}

export function requireAgentId(profile: ClientProfile): string {
  if (!profile.agentId) {
    throw new ClientError(
      ErrorCode.AGENT_NOT_CONFIGURED,
      "No agent configured in this profile.",
      "Run `vibly agent register` first.",
    );
  }
  return profile.agentId;
}

export function requireProjectId(profile: ClientProfile): string {
  if (!profile.projectId) {
    throw new ClientError(
      ErrorCode.PROJECT_NOT_SELECTED,
      "No project selected for this profile.",
      "Run `vibly project list` and `vibly project use <projectId>`.",
    );
  }
  return profile.projectId;
}

export function saveProfile(
  config: ClientConfig,
  profile: ClientProfile,
): void {
  config.profiles[profile.name] = profile;
  saveConfig(config);
}

export function createProfile(
  config: ClientConfig,
  name: string,
  coordinatorUrl?: string,
): ClientProfile {
  const profile: ClientProfile = {
    name,
    coordinatorUrl: coordinatorUrl ?? "http://localhost:8787",
    apiTokenRef: "env:VIBLY_API_TOKEN",
    network: {
      id: process.env["VIBLY_NETWORK_ID"] ?? "substrate:vibly-solo",
      displayName: process.env["VIBLY_NETWORK_NAME"] ?? "Vibly Local",
      stage: process.env["VIBLY_NETWORK_STAGE"] ?? "local",
      coordinatorUrl: coordinatorUrl ?? "http://localhost:8787",
      viblyGenesisHash: process.env["VIBLY_GENESIS_HASH"],
      relayRpcUrl: process.env["RELAY_RPC_URL"],
      viblyRpcUrl: process.env["VIBLY_RPC_URL"],
    },
  };
  saveProfile(config, profile);
  return profile;
}

export function listProfiles(config: ClientConfig): ClientProfile[] {
  return Object.values(config.profiles);
}

export function setDefaultProfile(
  config: ClientConfig,
  name: string,
): void {
  if (!config.profiles[name]) {
    throw new ClientError(
      ErrorCode.PROFILE_NOT_FOUND,
      `Profile "${name}" not found.`,
    );
  }
  config.defaultProfile = name;
  saveConfig(config);
}

/** Load config + resolve active profile in one call */
export function loadActiveProfile(configPath?: string): {
  config: ClientConfig;
  profile: ClientProfile;
} {
  const config = loadConfig(configPath);
  const profile = getActiveProfile(config);
  return { config, profile };
}
