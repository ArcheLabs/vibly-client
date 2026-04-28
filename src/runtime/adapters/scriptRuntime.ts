import { execa } from "execa";
import { writeFileSync, readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeExecutionInput } from "../../domain/clientTypes.js";
import type { LocalRuntimeConfig } from "../../domain/clientTypes.js";
import type { AdapterResult } from "../runtimeHost.js";
import { ClientError, ErrorCode } from "../../domain/errors.js";
import { createSandbox } from "../sandbox.js";

export async function runScript(
  config: LocalRuntimeConfig,
  input: RuntimeExecutionInput,
): Promise<AdapterResult> {
  if (!config.command) {
    throw new ClientError(ErrorCode.EXECUTION_FAILED, `Runtime '${config.name}' has no command configured`);
  }

  const sandbox = createSandbox("vibly-script");

  try {
    // Write context files to workDir so scripts can read them
    if (input.contextBundleJson) {
      writeFileSync(
        join(sandbox.workDir, "context_bundle.json"),
        input.contextBundleJson,
      );
    }
    if (input.contextReceiptJson) {
      writeFileSync(
        join(sandbox.workDir, "context_receipt.json"),
        input.contextReceiptJson,
      );
    }

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      VIBLY_WORK_ORDER_JSON: input.workOrderJson,
      VIBLY_CONTEXT_BUNDLE_JSON: input.contextBundleJson ?? "",
      VIBLY_CONTEXT_RECEIPT_JSON: input.contextReceiptJson ?? "",
      VIBLY_OUTPUT_DIR: sandbox.outputDir,
      VIBLY_WORK_DIR: sandbox.workDir,
      ...(config.env ?? {}),
    };

    const timeoutMs = config.timeoutMs ?? 300_000;
    const parts = config.command.split(/\s+/);
    const [cmd, ...args] = parts;

    const result = await execa(cmd, args, {
      env,
      cwd: sandbox.workDir,
      timeout: timeoutMs,
      reject: false,
    });

    if (result.exitCode !== 0) {
      throw new ClientError(
        ErrorCode.EXECUTION_FAILED,
        `Script exited with code ${String(result.exitCode)}: ${result.stderr}`,
      );
    }

    // Read result.json if present
    let summary = "Script completed";
    const resultJsonPath = join(sandbox.outputDir, "result.json");
    if (existsSync(resultJsonPath)) {
      try {
        const raw = JSON.parse(readFileSync(resultJsonPath, "utf8")) as { summary?: string };
        summary = raw.summary ?? summary;
      } catch {
        // ignore
      }
    }

    // Collect output artifacts
    const artifactPaths = existsSync(sandbox.outputDir)
      ? readdirSync(sandbox.outputDir).map((f) => join(sandbox.outputDir, f))
      : [];

    return {
      status: "success",
      summary,
      stdout: result.stdout,
      stderr: result.stderr,
      outputDir: sandbox.outputDir,
      artifactPaths,
    };
  } catch (e) {
    sandbox.cleanup();
    if (e instanceof ClientError) throw e;
    throw new ClientError(ErrorCode.EXECUTION_FAILED, String(e));
  }
}
