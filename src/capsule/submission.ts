import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { createHash } from "node:crypto";
import { getArtifactsDir, getWorkspaceDir } from "../config/paths.js";
import { assertSafePath } from "../security/pathBoundary.js";
import type { CapsuleArtifact, CapsuleSubmission } from "./types.js";
import { loadManifest, updateManifest } from "./generator.js";

// ── MIME type helpers ─────────────────────────────────────────────────────────

const EXT_MIME: Record<string, string> = {
  ".json": "application/json",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".py": "text/x-python",
  ".ts": "text/typescript",
  ".js": "application/javascript",
  ".sh": "application/x-sh",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".csv": "text/csv",
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
};

function guessMediaType(filename: string): string {
  return EXT_MIME[extname(filename).toLowerCase()] ?? "application/octet-stream";
}

function sha256File(absolutePath: string): string {
  const data = readFileSync(absolutePath);
  return createHash("sha256").update(data).digest("hex");
}

// ── Artifact collector ────────────────────────────────────────────────────────

/**
 * Recursively collect all files under the artifacts directory.
 * Applies path boundary checks and silently skips forbidden files.
 */
export function collectArtifacts(taskId: string): CapsuleArtifact[] {
  const artifactsDir = getArtifactsDir(taskId);
  if (!existsSync(artifactsDir)) return [];

  const artifacts: CapsuleArtifact[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const absPath = join(dir, entry);
      const stat = statSync(absPath);
      if (stat.isDirectory()) {
        walk(absPath);
      } else if (stat.isFile()) {
        if (!assertSafePathSilent(absPath)) continue;
        artifacts.push({
          relativePath: relative(artifactsDir, absPath),
          absolutePath: absPath,
          mediaType: guessMediaType(entry),
          hash: sha256File(absPath),
          sizeBytes: stat.size,
        });
      }
    }
  }

  walk(artifactsDir);
  return artifacts;
}

function assertSafePathSilent(p: string): boolean {
  try {
    assertSafePath(p);
    return true;
  } catch {
    return false;
  }
}

// ── Build submission ──────────────────────────────────────────────────────────

export interface BuildSubmissionInput {
  taskId: string;
  summary: string;
  structuredResult?: Record<string, unknown>;
  executorId?: string;
}

/**
 * Collect artifacts, build the submission record, write submission.json,
 * and update the capsule manifest status to "completed".
 */
export function buildSubmission(input: BuildSubmissionInput): CapsuleSubmission {
  const { taskId, summary, structuredResult, executorId } = input;
  const artifacts = collectArtifacts(taskId);

  const manifest = loadManifest(taskId);
  const submission: CapsuleSubmission = {
    taskId,
    localAgentId: manifest?.localAgentId,
    summary,
    artifacts,
    structuredResult,
    executorId,
    completedAt: new Date().toISOString(),
  };

  const submissionPath = join(getWorkspaceDir(taskId), "submission.json");
  writeFileSync(submissionPath, `${JSON.stringify(submission, null, 2)}\n`, "utf8");

  if (manifest) {
    updateManifest(taskId, { status: "completed" });
  }

  return submission;
}
