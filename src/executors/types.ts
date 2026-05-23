import type { CapsuleManifest } from "../capsule/types.js";

// ── Executor Adapter Interface ────────────────────────────────────────────────

export type ExecutorStatus = "success" | "failed" | "partial";

export interface ExecutorDetectResult {
  /** Whether this executor is available on the current system. */
  available: boolean;
  /** Human-readable version string if detected. */
  version?: string;
  /** Reason unavailable (if !available). */
  reason?: string;
}

export interface ExecutorResult {
  status: ExecutorStatus;
  summary: string;
  stdout?: string;
  stderr?: string;
  /** Absolute paths to generated output files. */
  artifactPaths: string[];
  /** Optional machine-readable structured result. */
  structuredResult?: Record<string, unknown>;
  executorId: string;
  durationMs: number;
}

/**
 * Common interface all executor adapters must implement.
 *
 * Adapters are responsible for:
 * 1. `detect()` — probing availability (no side-effects)
 * 2. `run(manifest)` — executing the task capsule and producing artifacts
 *
 * Adapters MUST NOT read or write outside the paths listed in
 * `manifest.permissions.writePaths` and MUST NOT leak session keys.
 */
export interface ExecutorAdapter {
  /** Unique, stable identifier (e.g. "generic-shell", "codex", "claude"). */
  readonly id: string;
  /** Human-readable display name. */
  readonly displayName: string;

  detect(): Promise<ExecutorDetectResult>;
  run(manifest: CapsuleManifest, timeoutMs?: number): Promise<ExecutorResult>;
}
