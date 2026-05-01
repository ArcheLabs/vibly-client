import { ClientError } from "../../../domain/errors.js";
import { outputErr, printOutput } from "../../../domain/apiTypes.js";

/**
 * Standard CLI error reporter.
 *
 * Replaces the ad-hoc `handleError(e, json?)` helper duplicated across
 * many command files. Translates `ClientError` to its structured
 * `{ code, message, hint }` envelope; falls back to `COORDINATOR_API_ERROR`
 * for anything else (network errors, unexpected exceptions, raw strings).
 */
export function handleCliError(e: unknown, json?: boolean): void {
  if (e instanceof ClientError) {
    printOutput(outputErr(e.code, e.message, e.hint), Boolean(json));
  } else {
    printOutput(outputErr("COORDINATOR_API_ERROR", String(e)), Boolean(json));
  }
  process.exitCode = 1;
}
