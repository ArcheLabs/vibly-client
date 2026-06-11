import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export const CLIENT_PACKAGE_NAME = "@vibly-ai/client";
export const CLIENT_VERSION = process.env["VIBLY_CLIENT_VERSION"] ?? readPackageVersion(new URL("../package.json", import.meta.url), "0.0.0");
export const CONTRACT_VERSION = process.env["VIBLY_CONTRACT_VERSION"] ?? readCoordinatorContractVersion("0.0.0");
export const PROTOCOL_VERSION = process.env["VIBLY_PROTOCOL_VERSION"] ?? "0.2";

export interface ClientVersionHeaderValues {
  packageName: string;
  clientVersion: string;
  contractVersion: string;
  protocolVersion: string;
}

export function clientVersionHeaderValues(): ClientVersionHeaderValues {
  return {
    packageName: CLIENT_PACKAGE_NAME,
    clientVersion: process.env["VIBLY_CLIENT_VERSION"] ?? CLIENT_VERSION,
    contractVersion: process.env["VIBLY_CONTRACT_VERSION"] ?? CONTRACT_VERSION,
    protocolVersion: process.env["VIBLY_PROTOCOL_VERSION"] ?? PROTOCOL_VERSION,
  };
}

export function clientVersionHeaders(): Record<string, string> {
  const values = clientVersionHeaderValues();
  return {
    "x-vibly-client-package": values.packageName,
    "x-vibly-client-version": values.clientVersion,
    "x-vibly-contract-version": values.contractVersion,
    "x-vibly-protocol-version": values.protocolVersion,
  };
}

function readCoordinatorContractVersion(fallback: string): string {
  try {
    const require = createRequire(import.meta.url);
    const clientEntry = require.resolve("@vibly-ai/coordinator-http-contract/client");
    const packageJsonPath = findPackageJson(dirname(clientEntry), "@vibly-ai/coordinator-http-contract");
    return packageJsonPath ? readPackageVersion(packageJsonPath, fallback) : fallback;
  } catch {
    return fallback;
  }
}

function findPackageJson(startDir: string, packageName: string): string | undefined {
  let current = startDir;
  for (let depth = 0; depth < 8; depth++) {
    const packageJsonPath = join(current, "package.json");
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string };
      if (pkg.name === packageName) return packageJsonPath;
    } catch {
      // keep walking up from nested dist directories
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
  return undefined;
}

function readPackageVersion(packageJsonPath: string | URL, fallback: string): string {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
    return typeof pkg.version === "string" && pkg.version.length > 0 ? pkg.version : fallback;
  } catch {
    return fallback;
  }
}
