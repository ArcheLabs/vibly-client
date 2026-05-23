import { existsSync } from "node:fs";
import { execa } from "execa";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { getArtifactsDir, getWorkspaceDir } from "../config/paths.js";
import type { ExecutorAdapter, ExecutorDetectResult, ExecutorResult } from "./types.js";
import type { CapsuleManifest } from "../capsule/types.js";

/**
 * Generic-Shell executor — wraps an arbitrary shell command.
 *
 * The capsule directory, task file, and artifacts dir are injected as
 * environment variables so any script can consume them directly.
 *
 * Environment variables set during execution:
 *   VIBLY_CAPSULE_DIR     — root of the capsule workspace
 *   VIBLY_TASK_ID         — task identifier
 *   VIBLY_TASK_FILE       — absolute path to task.md
 *   VIBLY_ARTIFACTS_DIR   — directory to write output files into
 *   VIBLY_WORKSPACE_DIR   — working directory for the script
 *
 * If the capsule has a `permissions.readPaths[0]` that contains a
 * `run.sh` file, it is executed automatically. Otherwise, the adapter
 * reports unavailable unless an explicit command is passed via
 * `VIBLY_EXEC_COMMAND` env var.
 */
export class GenericShellExecutor implements ExecutorAdapter {
  readonly id = "generic-shell";
  readonly displayName = "Generic Shell";

  async detect(): Promise<ExecutorDetectResult> {
    // Generic shell is always available if bash/sh is present
    try {
      const result = await execa("sh", ["--version"], { reject: false });
      return { available: true, version: result.stdout?.split("\n")[0]?.trim() ?? "sh" };
    } catch {
      return { available: false, reason: "sh not found" };
    }
  }

  async run(manifest: CapsuleManifest, timeoutMs = 300_000): Promise<ExecutorResult> {
    const start = Date.now();
    const capsuleDir = manifest.capsuleDir;
    const artifactsDir = getArtifactsDir(manifest.taskId);
    const workspaceDir = join(capsuleDir, "workspace");

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      VIBLY_CAPSULE_DIR: capsuleDir,
      VIBLY_TASK_ID: manifest.taskId,
      VIBLY_TASK_FILE: join(capsuleDir, "task.md"),
      VIBLY_ARTIFACTS_DIR: artifactsDir,
      VIBLY_WORKSPACE_DIR: workspaceDir,
    };

    // Prefer an explicit env override, otherwise look for run.sh
    const execCommand = process.env["VIBLY_EXEC_COMMAND"];
    const runScriptPath = join(capsuleDir, "run.sh");
    const cmd = execCommand ?? (existsSync(runScriptPath) ? runScriptPath : null);

    if (!cmd) {
      return {
        status: "failed",
        summary: "No run.sh found in capsule and VIBLY_EXEC_COMMAND is not set.",
        artifactPaths: [],
        executorId: this.id,
        durationMs: Date.now() - start,
      };
    }

    const result = await execa(cmd, [], {
      env,
      cwd: workspaceDir,
      timeout: timeoutMs,
      reject: false,
      shell: true,
    });

    const artifactPaths = existsSync(artifactsDir)
      ? readdirSync(artifactsDir).map((f) => join(artifactsDir, f))
      : [];

    const status = result.exitCode === 0 ? "success" : "failed";
    const summary = result.exitCode === 0
      ? `Script completed successfully (${artifactPaths.length} artifact(s))`
      : `Script exited with code ${String(result.exitCode)}`;

    return {
      status,
      summary,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
      artifactPaths,
      executorId: this.id,
      durationMs: Date.now() - start,
    };
  }
}

export const genericShellExecutor = new GenericShellExecutor();
