import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ClientConfig } from "../domain/clientTypes.js";
import { getConfigPath } from "./paths.js";

const DEFAULT_CONFIG: ClientConfig = {
  version: "0.1.0",
  defaultProfile: "default",
  profiles: {
    default: {
      name: "default",
      coordinatorUrl: "http://localhost:8787",
      apiTokenRef: "env:VIBLY_API_TOKEN",
      network: {
        id: "substrate:vibly-solo",
        displayName: "Vibly Local",
        stage: "local",
        coordinatorUrl: "http://localhost:8787",
      },
    },
  },
};

export function loadConfig(configPath?: string): ClientConfig {
  const p = configPath ?? getConfigPath();
  if (!existsSync(p)) return structuredClone(DEFAULT_CONFIG);
  try {
    return JSON.parse(readFileSync(p, "utf8")) as ClientConfig;
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveConfig(config: ClientConfig, configPath?: string): void {
  const p = configPath ?? getConfigPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  chmodSync(p, 0o600);
}

export function initConfig(configPath?: string): ClientConfig {
  const p = configPath ?? getConfigPath();
  if (existsSync(p)) return loadConfig(p);
  const cfg = structuredClone(DEFAULT_CONFIG);
  saveConfig(cfg, p);
  return cfg;
}

/** Set a nested key like "profiles.default.coordinatorUrl" */
export function setConfigKey(
  config: ClientConfig,
  key: string,
  value: string,
): ClientConfig {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = config;
  for (let i = 0; i < parts.length - 1; i++) {
    if (obj[parts[i]] === undefined) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
  return config;
}
