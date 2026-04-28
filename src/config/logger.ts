import pino from "pino";
import type { Logger } from "pino";
import { getClientLogPath } from "./paths.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

let _logger: Logger | null = null;

export function createLogger(level?: string, json?: boolean): Logger {
  const logLevel = level ?? process.env["VIBLY_LOG_LEVEL"] ?? "info";
  const logPath = getClientLogPath();
  try {
    mkdirSync(dirname(logPath), { recursive: true });
  } catch {
    // ignore
  }

  if (json) {
    return pino({ level: logLevel });
  }

  return pino(
    { level: logLevel },
    pino.multistream([
      {
        stream: pino.transport({
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        }),
      },
    ]),
  );
}

export function getLogger(): Logger {
  if (!_logger) _logger = createLogger();
  return _logger;
}

export function setLogger(logger: Logger): void {
  _logger = logger;
}
