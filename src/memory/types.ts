// ── Memory Types ──────────────────────────────────────────────────────────────

/**
 * Memory scope controls where entries are stored and who can read them.
 *
 * - "agent_private":  Local to this agent only; NEVER sent to coordinator or
 *                     other agents. Stored in ~/.vibly/memory/agent_private/
 * - "organization":   Org-level shared memory; requires coordinator approval
 *                     before entries become visible to other members.
 *                     Local copy in ~/.vibly/memory/organization/
 */
export type MemoryScope = "agent_private" | "organization";

/** Granularity / confidence signal for downstream filtering. */
export type MemoryKind =
  | "fact"          // verified fact
  | "observation"   // raw observation, lower confidence
  | "preference"    // behavioral preference / tuning note
  | "procedure"     // step-by-step process / SOP
  | "relationship"  // relationship between two entities
  | "episodic";     // time-anchored event memory

export interface MemoryEntry {
  id: string;
  scope: MemoryScope;
  ownerId: string;
  kind: MemoryKind;
  content: string;
  tags?: string[];
  source?: string;
  /** ISO-8601 */
  createdAt: string;
  /** ISO-8601 */
  updatedAt?: string;
  /** Expiry for ephemeral entries */
  expiresAt?: string;
  /** Whether this entry was flagged by the secret detector. */
  blocked?: boolean;
}

// ── Adapter types ─────────────────────────────────────────────────────────────

export type MemoryAdapterType = "local-file" | "sqlite";

export interface MemoryAdapterConfig {
  type: MemoryAdapterType;
  /** Adapter-specific options. */
  options?: Record<string, unknown>;
}

export interface MemoryWriteResult {
  entryId: string;
  blocked: boolean;
  blockReason?: string;
}

export interface MemoryQueryInput {
  scope?: MemoryScope;
  ownerId?: string;
  kind?: MemoryKind;
  query?: string;
  tags?: string[];
  limit?: number;
}

/**
 * Common interface all memory adapters must implement.
 *
 * Implementors MUST:
 * - Run entries through the secret detector before persisting.
 * - Scope storage under `{scope}/{ownerId}` to prevent cross-scope leakage.
 * - Never expose agent_private entries to network calls.
 */
export interface MemoryAdapter {
  readonly type: MemoryAdapterType;
  write(entry: MemoryEntry): Promise<MemoryWriteResult>;
  query(input: MemoryQueryInput): Promise<MemoryEntry[]>;
  delete(entryId: string): Promise<boolean>;
  status(): Promise<MemoryAdapterStatus>;
}

export interface MemoryAdapterStatus {
  type: MemoryAdapterType;
  healthy: boolean;
  entryCount?: number;
  storageDir?: string;
  detail?: string;
}
