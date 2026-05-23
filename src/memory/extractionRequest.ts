import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getWorkspaceDir } from "../config/paths.js";
import { detectSecrets } from "./secretDetector.js";
import type { MemoryAdapter, MemoryEntry, MemoryKind, MemoryScope } from "./types.js";

// ── Extraction Request ────────────────────────────────────────────────────────
//
// Generates a structured prompt instructing an agent to reflect on the
// current task and output extractable memory entries.
// The resulting entries are validated, screened by the secret detector,
// and then written to the configured adapter.

export interface ExtractionRequestOptions {
  taskId: string;
  localAgentId: string;
  scope: MemoryScope;
  kinds?: MemoryKind[];
  maxEntries?: number;
}

/**
 * Generate a `memory-request.md` file in the task capsule.
 * The agent is expected to fill in a JSON block and return it.
 */
export function generateExtractionRequest(opts: ExtractionRequestOptions): string {
  const { taskId, localAgentId, scope, kinds = ["fact", "observation", "procedure"], maxEntries = 5 } = opts;

  const requestPath = join(getWorkspaceDir(taskId), "memory-request.md");

  const content = `# Memory Extraction Request

After completing your task, please reflect and output up to **${maxEntries}** memory entries
that would be useful for future tasks. Focus on:
${kinds.map((k) => `- **${k}**`).join("\n")}

## Output Format

Return a JSON array inside a \`\`\`json block:

\`\`\`json
[
  {
    "kind": "fact",
    "content": "Your finding here (plain text, no credentials)",
    "tags": ["optional", "topic-tags"],
    "source": "task:${taskId}"
  }
]
\`\`\`

## Rules

- Do NOT include passwords, private keys, API tokens, mnemonics, or session secrets.
- Do NOT include content from ~/.vibly/ paths.
- Keep each entry under 500 characters.
- Only include entries that generalize beyond this specific task.

## Context

- Task ID: ${taskId}
- Agent: ${localAgentId}
- Scope: ${scope}
`;

  writeFileSync(requestPath, content, "utf8");
  return requestPath;
}

// ── Entry validator ───────────────────────────────────────────────────────────

interface RawEntry {
  kind?: unknown;
  content?: unknown;
  tags?: unknown;
  source?: unknown;
}

const VALID_KINDS: MemoryKind[] = ["fact", "observation", "preference", "procedure", "relationship", "episodic"];

/**
 * Parse and validate an array of raw memory entries from agent output.
 * Entries that fail validation or contain secrets are silently dropped.
 *
 * @returns `{ valid, blocked }` counts + entries ready for adapter write.
 */
export function parseAndValidateEntries(
  raw: unknown,
  scope: MemoryScope,
  ownerId: string,
  source: string,
): { entries: MemoryEntry[]; blockedCount: number } {
  if (!Array.isArray(raw)) return { entries: [], blockedCount: 0 };

  let blockedCount = 0;
  const entries: MemoryEntry[] = [];

  for (const item of raw as RawEntry[]) {
    if (typeof item !== "object" || item === null) continue;
    if (typeof item.content !== "string" || item.content.trim().length === 0) continue;
    if (item.content.length > 2000) continue; // Safety cap

    const kind = (typeof item.kind === "string" && VALID_KINDS.includes(item.kind as MemoryKind))
      ? (item.kind as MemoryKind)
      : "observation";

    const tags = Array.isArray(item.tags)
      ? (item.tags as unknown[]).filter((t): t is string => typeof t === "string")
      : undefined;

    const content = item.content.trim();

    // Secret detection
    const secrets = detectSecrets(content);
    if (secrets.length > 0) {
      blockedCount++;
      continue;
    }

    entries.push({
      id: randomUUID(),
      scope,
      ownerId,
      kind,
      content,
      tags,
      source: typeof item.source === "string" ? item.source : source,
      createdAt: new Date().toISOString(),
    });
  }

  return { entries, blockedCount };
}

/**
 * Write validated entries to a memory adapter.
 *
 * @returns Summary of what was written/blocked.
 */
export async function persistEntries(
  entries: MemoryEntry[],
  adapter: MemoryAdapter,
): Promise<{ written: number; blocked: number }> {
  let written = 0;
  let blocked = 0;

  for (const entry of entries) {
    const result = await adapter.write(entry);
    if (result.blocked) blocked++;
    else written++;
  }

  return { written, blocked };
}
