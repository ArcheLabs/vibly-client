import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

export function loadEnv(envPath?: string): void {
  if (loaded) return;
  const p = envPath ?? resolve(process.cwd(), ".env");
  if (existsSync(p)) loadDotenv({ path: p });
  loaded = true;
}

export function getEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export function resolveToken(tokenRef: string | undefined): string | undefined {
  if (!tokenRef) return undefined;
  if (tokenRef.startsWith("env:")) {
    const key = tokenRef.slice(4);
    return process.env[key];
  }
  return tokenRef;
}
