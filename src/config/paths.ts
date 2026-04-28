import { homedir } from "node:os";
import { join, resolve } from "node:path";

function resolveHome(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return resolve(p);
}

export function getViblyhome(): string {
  const raw = process.env["VIBLY_HOME"] ?? "~/.vibly";
  return resolveHome(raw);
}

export function getConfigPath(): string {
  return join(getViblyhome(), "config.json");
}

export function getProfileDir(): string {
  return join(getViblyhome(), "profiles");
}

export function getProfilePath(name: string): string {
  return join(getProfileDir(), `${name}.json`);
}

export function getDataDir(): string {
  return join(getViblyhome(), "data");
}

export function getDatabasePath(): string {
  return join(getDataDir(), "client.sqlite");
}

export function getKnowledgeDir(projectId: string): string {
  return join(getViblyhome(), "knowledge", projectId);
}

export function getRuntimeLogsDir(): string {
  return join(getViblyhome(), "runtime", "logs");
}

export function getClientLogPath(): string {
  return join(getViblyhome(), "client.log");
}

export function getTracesDir(): string {
  return join(getViblyhome(), "traces");
}

export function getCacheDir(): string {
  return join(getViblyhome(), "cache");
}
