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

// ─── Agent & workspace paths ──────────────────────────────────────────────────

/** Root directory for all locally-managed agent secrets / enrollment state. */
export function getAgentsDir(): string {
  return join(getViblyhome(), "agents");
}

/** Per-agent directory: ~/.vibly/agents/<agentId>/ */
export function getAgentDir(agentId: string): string {
  return join(getAgentsDir(), agentId);
}

/** Enrollment descriptor (public): ~/.vibly/agents/<agentId>/enrollment.json */
export function getAgentEnrollmentPath(agentId: string): string {
  return join(getAgentDir(agentId), "enrollment.json");
}

/** Session secret (private, NEVER share): ~/.vibly/agents/<agentId>/session.key */
export function getAgentSessionKeyPath(agentId: string): string {
  return join(getAgentDir(agentId), "session.key");
}

/** Root directory for all task capsule workspaces. */
export function getWorkspacesDir(): string {
  return join(getViblyhome(), "workspaces");
}

/** Per-task capsule workspace: ~/.vibly/workspaces/<taskId>/ */
export function getWorkspaceDir(taskId: string): string {
  return join(getWorkspacesDir(), taskId);
}

/** Capsule manifest file inside a task workspace. */
export function getManifestPath(taskId: string): string {
  return join(getWorkspaceDir(taskId), "manifest.json");
}

/** Artifacts output directory inside a task workspace. */
export function getArtifactsDir(taskId: string): string {
  return join(getWorkspaceDir(taskId), "artifacts");
}

/** Memory storage root: ~/.vibly/memory/ */
export function getMemoryDir(): string {
  return join(getViblyhome(), "memory");
}

/** Scoped memory directory: ~/.vibly/memory/<scope>/<ownerId>/ */
export function getMemoryScopeDir(scope: string, ownerId: string): string {
  return join(getMemoryDir(), scope, ownerId);
}
