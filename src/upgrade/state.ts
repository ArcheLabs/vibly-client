import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { getUpgradeStatePath } from "../config/paths.js";
import { CLIENT_VERSION } from "../version.js";
import type { UpgradePhase, UpgradeState } from "../domain/clientTypes.js";

export function loadUpgradeState(): UpgradeState {
  const path = getUpgradeStatePath();
  if (!existsSync(path)) return initialUpgradeState();
  try {
    return JSON.parse(readFileSync(path, "utf8")) as UpgradeState;
  } catch {
    return initialUpgradeState("failed", "Unreadable upgrade state");
  }
}

export function saveUpgradeState(state: UpgradeState): UpgradeState {
  const path = getUpgradeStatePath();
  mkdirSync(dirname(path), { recursive: true });
  const next = { ...state, updatedAt: new Date().toISOString() };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return next;
}

export function setUpgradePhase(phase: UpgradePhase, patch: Partial<UpgradeState> = {}): UpgradeState {
  const current = loadUpgradeState();
  return saveUpgradeState({ ...current, ...patch, phase });
}

function initialUpgradeState(phase: UpgradePhase = "idle", rollbackReason?: string): UpgradeState {
  return { currentVersion: CLIENT_VERSION, phase, rollbackReason, updatedAt: new Date().toISOString() };
}
