import { execSync } from "node:child_process";
import { execa } from "execa";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getArtifactsDir } from "../config/paths.js";
import type { ExecutorAdapter, ExecutorDetectResult, ExecutorResult } from "./types.js";
import type { CapsuleManifest } from "../capsule/types.js";

/**
 * Codex executor — delegates to the OpenAI Codex CLI.
 *
 * Passes `task.md` as the prompt and the capsule workspace as the working
 * directory. Artifacts are expected in the capsule artifacts dir.
 */
export class CodexExecutor implements ExecutorAdapter {
  readonly id = "codex";
  readonly displayName = "OpenAI Codex CLI";

  async detect(): Promise<ExecutorDetectResult> {
    try {
      const v = execSync("codex --version", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
      return { available: true, version: v };
    } catch {
      return { available: false, reason: "`codex` binary not found — install with: npm i -g @openai/codex" };
    }
  }

  async run(manifest: CapsuleManifest, timeoutMs = 600_000): Promise<ExecutorResult> {
    const start = Date.now();
    const capsuleDir = manifest.capsuleDir;
    const artifactsDir = getArtifactsDir(manifest.taskId);
    const taskFile = join(capsuleDir, "task.md");
    const workspaceDir = join(capsuleDir, "workspace");

    const result = await execa(
      "codex",
      ["--quiet", "--output-dir", artifactsDir, taskFile],
      {
        cwd: workspaceDir,
        timeout: timeoutMs,
        reject: false,
        env: {
          ...(process.env as Record<string, string>),
          VIBLY_CAPSULE_DIR: capsuleDir,
          VIBLY_TASK_ID: manifest.taskId,
          VIBLY_ARTIFACTS_DIR: artifactsDir,
        },
      },
    );

    const artifactPaths = existsSync(artifactsDir)
      ? readdirSync(artifactsDir).map((f) => join(artifactsDir, f))
      : [];

    const status = result.exitCode === 0 ? "success" : "failed";

    return {
      status,
      summary: result.exitCode === 0
        ? `Codex completed (${artifactPaths.length} artifact(s))`
        : `Codex exited ${String(result.exitCode)}: ${result.stderr ?? ""}`,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
      artifactPaths,
      executorId: this.id,
      durationMs: Date.now() - start,
    };
  }
}

export const codexExecutor = new CodexExecutor();
