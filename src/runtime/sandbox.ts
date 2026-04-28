import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

export interface Sandbox {
  workDir: string;
  outputDir: string;
  cleanup: () => void;
}

export function createSandbox(prefix = "vibly-run"): Sandbox {
  const id = randomUUID().slice(0, 8);
  const workDir = join(tmpdir(), `${prefix}-${id}`);
  const outputDir = join(workDir, "output");

  mkdirSync(outputDir, { recursive: true });

  return {
    workDir,
    outputDir,
    cleanup() {
      try {
        rmSync(workDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    },
  };
}
