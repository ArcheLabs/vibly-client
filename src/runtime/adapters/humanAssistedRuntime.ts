import * as readline from "node:readline";
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeExecutionInput } from "../../domain/clientTypes.js";
import type { AdapterResult } from "../runtimeHost.js";
import { createSandbox } from "../sandbox.js";

export async function runHumanAssisted(
  input: RuntimeExecutionInput,
): Promise<AdapterResult> {
  const sandbox = createSandbox("vibly-human");

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  try {
    console.error(`\n--- Human-Assisted Runtime ---`);
    console.error(`Work Order: ${input.workOrderId}`);
    console.error(`Output directory: ${sandbox.outputDir}\n`);

    const summary = await ask("Summary of work completed: ");
    const artifactPath = await ask(
      `Path to artifact file (or press Enter to skip): `,
    );

    rl.close();

    const artifactPaths: string[] = [];

    if (artifactPath.trim()) {
      const targetPath = join(sandbox.outputDir, "artifact");
      if (existsSync(artifactPath.trim())) {
        const { copyFileSync } = await import("node:fs");
        copyFileSync(artifactPath.trim(), targetPath);
        artifactPaths.push(targetPath);
      } else {
        console.error(`Warning: artifact path '${artifactPath}' not found, skipping`);
      }
    }

    const resultJson = { summary: summary.trim() };
    writeFileSync(join(sandbox.outputDir, "result.json"), JSON.stringify(resultJson, null, 2));
    artifactPaths.push(join(sandbox.outputDir, "result.json"));

    return {
      status: "success",
      summary: summary.trim(),
      outputDir: sandbox.outputDir,
      artifactPaths,
    };
  } catch (e) {
    rl.close();
    sandbox.cleanup();
    throw e;
  }
}
