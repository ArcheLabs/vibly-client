/** Standard CLI JSON output wrapper */
export interface ApiOutput<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; hint?: string };
  meta?: Record<string, unknown>;
}

export function outputOk<T>(data: T, meta?: Record<string, unknown>): ApiOutput<T> {
  return { ok: true, data, ...(meta ? { meta } : {}) };
}

export function outputErr(
  code: string,
  message: string,
  hint?: string,
): ApiOutput<never> {
  return { ok: false, error: { code, message, ...(hint ? { hint } : {}) } };
}

/** Print result to stdout, respecting --json flag */
export function printOutput(
  data: ApiOutput,
  json: boolean,
  formatFn?: (d: unknown) => string,
): void {
  if (json) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  } else if (data.ok && formatFn && data.data !== undefined) {
    process.stdout.write(formatFn(data.data) + "\n");
  } else if (data.ok) {
    process.stdout.write(JSON.stringify(data.data, null, 2) + "\n");
  } else {
    process.stderr.write(
      `Error: ${data.error?.code}\n${data.error?.message}\n`,
    );
    if (data.error?.hint) process.stderr.write(`${data.error.hint}\n`);
  }
}
