import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import type { ArtifactRef } from "../coordinator/types.js";

export interface ExecutionReceipt {
  id: string;
  workOrderId: string;
  agentId: string;
  runtimeId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  artifacts: ArtifactRef[];
  summary: string;
}

export function buildExecutionReceipt(opts: {
  workOrderId: string;
  agentId: string;
  runtimeId: string;
  startedAt: Date;
  finishedAt: Date;
  outputDir: string;
  artifactPaths: string[];
  summary: string;
}): ExecutionReceipt {
  const artifacts: ArtifactRef[] = opts.artifactPaths.map((p) => {
    const uri = p.startsWith("/") ? `file://${p}` : `file://${join(opts.outputDir, p)}`;
    const fullPath = p.startsWith("/") ? p : join(opts.outputDir, p);
    let sha256: string | undefined;
    try {
      const data = readFileSync(fullPath);
      sha256 = createHash("sha256").update(data).digest("hex");
    } catch {
      // ignore read errors
    }
    return {
      uri,
      label: basename(fullPath),
      sha256,
    };
  });

  return {
    id: randomUUID(),
    workOrderId: opts.workOrderId,
    agentId: opts.agentId,
    runtimeId: opts.runtimeId,
    startedAt: opts.startedAt.toISOString(),
    finishedAt: opts.finishedAt.toISOString(),
    durationMs: opts.finishedAt.getTime() - opts.startedAt.getTime(),
    artifacts,
    summary: opts.summary,
  };
}
