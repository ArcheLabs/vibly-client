// ── Task Capsule Types ────────────────────────────────────────────────────────
//
// A "capsule" is the structured workspace created for each assigned task.
// It bundles task context, previous submission history, memory mounts, and
// permissions into a reproducible directory layout that executor adapters
// consume.

export type CapsuleStatus = "pending" | "prepared" | "running" | "completed" | "failed";

/** Core task metadata written from coordinator data. */
export interface CapsuleTask {
  id: string;
  kind: string;
  title?: string;
  description?: string;
  organizationId?: string;
  projectId?: string;
  /** ISO-8601 deadline. */
  deadlineAt?: string;
  /** Raw task payload as received from coordinator. */
  payload?: Record<string, unknown>;
}

/** A previous submission for context (iteration history). */
export interface PreviousSubmission {
  submissionId: string;
  submittedAt: string;
  summary?: string;
  reviewSummary?: string;
  reviewOutcome?: "approved" | "rejected" | "revision_required" | "pending";
}

/** Memory mount points the agent may read from the capsule. */
export interface MemoryMountRequest {
  scope: "agent_private" | "organization";
  ownerId: string;
  /** Human-readable label for prompt injection. */
  label?: string;
}

/** Path-level permissions declared in the manifest. */
export interface CapsulePermissions {
  /** Absolute paths or globs the executor is allowed to read. */
  readPaths: string[];
  /** Absolute paths or globs the executor is allowed to write. */
  writePaths: string[];
  /** Whether network access is expected. */
  networkAccess: boolean;
  /** Whether the executor may spawn sub-processes. */
  subProcesses: boolean;
}

/** The manifest.json written at capsule root. */
export interface CapsuleManifest {
  version: "0.1";
  taskId: string;
  localAgentId?: string;
  capsuleDir: string;
  status: CapsuleStatus;
  task: CapsuleTask;
  previousSubmissions: PreviousSubmission[];
  memoryMounts: MemoryMountRequest[];
  permissions: CapsulePermissions;
  createdAt: string;
  preparedAt?: string;
  executorId?: string;
}

/** Result artifact collected after execution. */
export interface CapsuleArtifact {
  /** Path relative to capsule artifacts dir. */
  relativePath: string;
  /** Absolute filesystem path. */
  absolutePath: string;
  /** MIME type guess. */
  mediaType?: string;
  /** SHA-256 hex of file contents. */
  hash?: string;
  /** Byte size. */
  sizeBytes?: number;
}

/** Summary written to submission.json for coordinator upload. */
export interface CapsuleSubmission {
  taskId: string;
  localAgentId?: string;
  summary: string;
  artifacts: CapsuleArtifact[];
  structuredResult?: Record<string, unknown>;
  executorId?: string;
  completedAt: string;
}
