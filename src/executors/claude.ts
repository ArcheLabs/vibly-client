import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import { getArtifactsDir } from "../config/paths.js";
import type { ExecutorAdapter, ExecutorDetectResult, ExecutorResult } from "./types.js";
import type { CapsuleManifest } from "../capsule/types.js";

/**
 * Claude executor — delegates to the Anthropic Claude CLI.
 *
 * Detection checks for the `claude` binary first; falls back to
 * checking for `ANTHROPIC_API_KEY` in the environment which allows
 * use via `npx @anthropic-ai/claude-code` or similar wrapper.
 */
export class ClaudeExecutor implements ExecutorAdapter {
  readonly id = "claude";
  readonly displayName = "Anthropic Claude CLI";

  async detect(): Promise<ExecutorDetectResult> {
    // Check binary
    try {
      const v = execSync("claude --version", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
      return { available: true, version: v };
    } catch {
      // Binary not found — check for API key as fallback indicator
      if (process.env["ANTHROPIC_API_KEY"]) {
        return { available: false, reason: "`claude` binary not found but ANTHROPIC_API_KEY is set — install: npm i -g @anthropic-ai/claude-code" };
      }
      return { available: false, reason: "`claude` binary not found and ANTHROPIC_API_KEY is not set" };
    }
  }

  async run(manifest: CapsuleManifest, timeoutMs = 600_000): Promise<ExecutorResult> {
    const start = Date.now();
    const capsuleDir = manifest.capsuleDir;
    const artifactsDir = getArtifactsDir(manifest.taskId);
    const taskFile = join(capsuleDir, "task.md");
    const workspaceDir = join(capsuleDir, "workspace");

    // claude CLI: `claude --print <prompt>` or pipe task.md
    const result = await execa(
      "claude",
      ["--print", `--output-dir=${artifactsDir}`, "--allowedTools=Bash,Read,Write,Edit", taskFile],
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
        ? `Claude completed (${artifactPaths.length} artifact(s))`
        : `Claude exited ${String(result.exitCode)}: ${result.stderr ?? ""}`,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
      artifactPaths,
      executorId: this.id,
      durationMs: Date.now() - start,
    };
  }
}

export const claudeExecutor = new ClaudeExecutor();
