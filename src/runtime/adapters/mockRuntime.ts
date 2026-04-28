import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeExecutionInput } from "../../domain/clientTypes.js";
import type { AdapterResult } from "../runtimeHost.js";
import { createSandbox } from "../sandbox.js";

export async function runMock(
  _input: RuntimeExecutionInput,
): Promise<AdapterResult> {
  const sandbox = createSandbox("vibly-mock");

  const resultJson = {
    summary: "Mock execution completed successfully",
    confidence: 0.9,
    artifacts: ["report.md"],
  };

  writeFileSync(join(sandbox.outputDir, "result.json"), JSON.stringify(resultJson, null, 2));
  writeFileSync(
    join(sandbox.outputDir, "report.md"),
    `# Mock Report\n\nThis is a mock execution result generated for testing.\n`,
  );

  return {
    status: "success",
    summary: resultJson.summary,
    outputDir: sandbox.outputDir,
    artifactPaths: [join(sandbox.outputDir, "report.md"), join(sandbox.outputDir, "result.json")],
  };
}
