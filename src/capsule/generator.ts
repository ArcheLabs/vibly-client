import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { getWorkspaceDir, getManifestPath, getArtifactsDir } from "../config/paths.js";
import type { CapsuleManifest, CapsuleTask, PreviousSubmission } from "./types.js";
import { capsuleManifestSchema } from "./schema.js";

// ── Capsule Generator ─────────────────────────────────────────────────────────

export interface GenerateCapsuleInput {
  task: CapsuleTask;
  previousSubmissions?: PreviousSubmission[];
  localAgentId?: string;
  /** Overwrite an existing capsule if it already exists. */
  force?: boolean;
}

/**
 * Create the capsule directory structure for a task.
 *
 * Layout:
 *   ~/.vibly/workspaces/<taskId>/
 *     manifest.json
 *     task.md              ← human-readable task description
 *     previous-submissions.json
 *     artifacts/           ← executor writes outputs here
 *     workspace/           ← executor working directory
 */
export function generateCapsule(input: GenerateCapsuleInput): CapsuleManifest {
  const { task, previousSubmissions = [], localAgentId, force = false } = input;
  const capsuleDir = getWorkspaceDir(task.id);
  const manifestPath = getManifestPath(task.id);

  if (existsSync(manifestPath) && !force) {
    // Return existing manifest
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
    const parsed = capsuleManifestSchema.safeParse(raw);
    if (parsed.success) return parsed.data as CapsuleManifest;
  }

  mkdirSync(capsuleDir, { recursive: true });
  mkdirSync(getArtifactsDir(task.id), { recursive: true });
  mkdirSync(`${capsuleDir}/workspace`, { recursive: true });

  const now = new Date().toISOString();

  const manifest: CapsuleManifest = {
    version: "0.1",
    taskId: task.id,
    localAgentId,
    capsuleDir,
    status: "prepared",
    task,
    previousSubmissions,
    memoryMounts: [],
    permissions: {
      readPaths: [capsuleDir],
      writePaths: [getArtifactsDir(task.id), `${capsuleDir}/workspace`],
      networkAccess: false,
      subProcesses: true,
    },
    createdAt: now,
    preparedAt: now,
  };

  // Write manifest
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  // Write human-readable task description
  const lines: string[] = [
    `# Task: ${task.title ?? task.id}`,
    ``,
    `**Task ID**: ${task.id}`,
    `**Kind**: ${task.kind}`,
    task.deadlineAt ? `**Deadline**: ${task.deadlineAt}` : "",
    task.organizationId ? `**Organization**: ${task.organizationId}` : "",
    task.projectId ? `**Project**: ${task.projectId}` : "",
    ``,
    `## Description`,
    ``,
    task.description ?? "_No description provided._",
    ``,
  ];

  if (task.payload && Object.keys(task.payload).length > 0) {
    lines.push(`## Payload`, ``, "```json", JSON.stringify(task.payload, null, 2), "```", "");
  }

  writeFileSync(`${capsuleDir}/task.md`, lines.filter((l) => l !== undefined).join("\n"), "utf8");

  // Write previous submissions
  writeFileSync(
    `${capsuleDir}/previous-submissions.json`,
    `${JSON.stringify(previousSubmissions, null, 2)}\n`,
    "utf8",
  );

  return manifest;
}

/** Load an existing capsule manifest from disk. */
export function loadManifest(taskId: string): CapsuleManifest | null {
  const manifestPath = getManifestPath(taskId);
  if (!existsSync(manifestPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
    const parsed = capsuleManifestSchema.safeParse(raw);
    return parsed.success ? (parsed.data as CapsuleManifest) : null;
  } catch {
    return null;
  }
}

/** Update a field in the capsule manifest (writes back to disk). */
export function updateManifest(taskId: string, patch: Partial<CapsuleManifest>): CapsuleManifest {
  const existing = loadManifest(taskId);
  if (!existing) throw new Error(`No capsule found for taskId: ${taskId}`);
  const updated: CapsuleManifest = { ...existing, ...patch };
  writeFileSync(getManifestPath(taskId), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  return updated;
}
