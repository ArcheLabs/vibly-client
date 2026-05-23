import { homedir } from "node:os";
import { resolve, normalize, sep } from "node:path";
import { getViblyhome } from "../config/paths.js";

// ── Forbidden path prefixes / patterns ───────────────────────────────────────
//
// These paths must never appear inside a capsule artifact or be accessible
// by executor adapters. The list is security-critical — extend carefully.

const FORBIDDEN_PREFIXES: string[] = [
  // Session secrets
  `${homedir()}/.vibly`, // entire VIBLY_HOME subtree
  `${homedir()}/.ssh`,
  `${homedir()}/.gnupg`,
  `${homedir()}/.aws`,
  `${homedir()}/.config/gcloud`,
  "/etc/shadow",
  "/etc/passwd",
  "/etc/ssh",
  "/run/secrets",
  "/var/run/secrets",
];

const FORBIDDEN_FILENAME_PATTERNS: RegExp[] = [
  /session\.key$/i,
  /\.env(\.\w+)?$/,
  /id_rsa(\.pub)?$/,
  /id_ed25519(\.pub)?$/,
  /id_ecdsa(\.pub)?$/,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i,
];

/**
 * Check whether a given absolute path is safe to include in a capsule.
 *
 * @throws `Error` with a descriptive message if the path is forbidden.
 */
export function assertSafePath(absolutePath: string): void {
  const normalized = normalize(resolve(absolutePath));

  // Reject path traversal attempts pointing into VIBLY_HOME or sensitive dirs
  const viblyhome = normalize(resolve(getViblyhome()));
  if (normalized === viblyhome || normalized.startsWith(viblyhome + sep)) {
    throw new Error(`Security violation: path inside VIBLY_HOME is forbidden: ${normalized}`);
  }

  for (const prefix of FORBIDDEN_PREFIXES) {
    const normPrefix = normalize(resolve(prefix));
    if (normalized === normPrefix || normalized.startsWith(normPrefix + sep)) {
      throw new Error(`Security violation: path inside forbidden prefix '${prefix}': ${normalized}`);
    }
  }

  for (const pattern of FORBIDDEN_FILENAME_PATTERNS) {
    if (pattern.test(normalized)) {
      throw new Error(`Security violation: path matches forbidden filename pattern '${String(pattern)}': ${normalized}`);
    }
  }
}

/** Return true if the path is safe, false otherwise (non-throwing). */
export function isSafePath(absolutePath: string): boolean {
  try {
    assertSafePath(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/** Filter an array of paths, returning only those that are safe. */
export function filterSafePaths(paths: string[]): string[] {
  return paths.filter(isSafePath);
}
