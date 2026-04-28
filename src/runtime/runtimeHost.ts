import type { LocalRuntimeConfig, RuntimeExecutionInput } from "../domain/clientTypes.js";
import { ClientError, ErrorCode } from "../domain/errors.js";
import { runScript } from "./adapters/scriptRuntime.js";
import { runMock } from "./adapters/mockRuntime.js";
import { runHumanAssisted } from "./adapters/humanAssistedRuntime.js";
import { buildExecutionReceipt, type ExecutionReceipt } from "./receipts.js";

/** Intermediate result returned by each runtime adapter */
export interface AdapterResult {
  status: "success" | "failed" | "partial";
  summary: string;
  stdout?: string;
  stderr?: string;
  outputDir: string;
  artifactPaths: string[];
}

export interface RuntimeHostResult {
  status: "success" | "failed" | "partial";
  summary: string;
  executionReceipt: ExecutionReceipt;
  stdout?: string;
  stderr?: string;
}

export class RuntimeHost {
  async run(
    config: LocalRuntimeConfig,
    input: RuntimeExecutionInput,
  ): Promise<RuntimeHostResult> {
    const startedAt = new Date();

    let result: AdapterResult;

    switch (config.runtimeType) {
      case "script":
        result = await runScript(config, input);
        break;
      case "mock":
        result = await runMock(input);
        break;
      case "human_assisted":
        result = await runHumanAssisted(input);
        break;
      default:
        throw new ClientError(
          ErrorCode.EXECUTION_FAILED,
          `Unknown runtime type: ${String(config.runtimeType)}`,
        );
    }

    const finishedAt = new Date();
    const executionReceipt = buildExecutionReceipt({
      workOrderId: input.workOrderId,
      agentId: input.agentId,
      runtimeId: config.id,
      startedAt,
      finishedAt,
      outputDir: result.outputDir,
      artifactPaths: result.artifactPaths,
      summary: result.summary,
    });

    return {
      status: result.status,
      summary: result.summary,
      executionReceipt,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
}
