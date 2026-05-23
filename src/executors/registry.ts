import type { ExecutorAdapter, ExecutorDetectResult, ExecutorResult } from "./types.js";
import type { CapsuleManifest } from "../capsule/types.js";
import { genericShellExecutor } from "./genericShell.js";
import { codexExecutor } from "./codex.js";
import { claudeExecutor } from "./claude.js";

// ── Executor Registry ─────────────────────────────────────────────────────────

/** Ordered list of known executors for auto-detection. */
const EXECUTORS: ExecutorAdapter[] = [
  codexExecutor,
  claudeExecutor,
  genericShellExecutor,
];

/**
 * Auto-detect the best available executor.
 * Returns the first executor that reports `available: true`, in priority order.
 */
export async function detectBestExecutor(): Promise<ExecutorAdapter | null> {
  for (const executor of EXECUTORS) {
    const result = await executor.detect();
    if (result.available) return executor;
  }
  return null;
}

/** Get all executors with their detection results. */
export async function detectAllExecutors(): Promise<Array<{ executor: ExecutorAdapter; detect: ExecutorDetectResult }>> {
  return Promise.all(
    EXECUTORS.map(async (e) => ({ executor: e, detect: await e.detect() })),
  );
}

/** Look up an executor by ID. */
export function getExecutorById(id: string): ExecutorAdapter | null {
  return EXECUTORS.find((e) => e.id === id) ?? null;
}

// ── Run dispatch ──────────────────────────────────────────────────────────────

export interface RunWithExecutorInput {
  executorId: string;
  manifest: CapsuleManifest;
  timeoutMs?: number;
}

/**
 * Run the capsule with the given executor (or auto-select if id === "auto").
 * Throws if the requested executor is not found or not available.
 */
export async function runWithExecutor(input: RunWithExecutorInput): Promise<ExecutorResult> {
  const { executorId, manifest, timeoutMs } = input;

  let executor: ExecutorAdapter | null;

  if (executorId === "auto") {
    executor = await detectBestExecutor();
    if (!executor) {
      return {
        status: "failed",
        summary: "No executor is available. Install codex, claude, or provide a run.sh in the capsule directory.",
        artifactPaths: [],
        executorId: "auto",
        durationMs: 0,
      };
    }
  } else {
    executor = getExecutorById(executorId);
    if (!executor) {
      return {
        status: "failed",
        summary: `Unknown executor: '${executorId}'. Available: ${EXECUTORS.map((e) => e.id).join(", ")}`,
        artifactPaths: [],
        executorId,
        durationMs: 0,
      };
    }
    const detect = await executor.detect();
    if (!detect.available) {
      return {
        status: "failed",
        summary: `Executor '${executorId}' is not available: ${detect.reason ?? "unknown reason"}`,
        artifactPaths: [],
        executorId,
        durationMs: 0,
      };
    }
  }

  return executor.run(manifest, timeoutMs);
}
