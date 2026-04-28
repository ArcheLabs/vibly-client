import type { ClientConfig, ClientProfile } from "../domain/clientTypes.js";
import { ClientError, ErrorCode } from "../domain/errors.js";
import { loadConfig, saveConfig } from "./config.js";
import { resolveToken } from "./env.js";

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
