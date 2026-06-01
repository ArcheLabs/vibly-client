import { execa } from "execa";
import type { CoordinatorClient } from "../coordinator/client.js";
import type { ClientProfile, VersionPolicy } from "../domain/clientTypes.js";
import { CLIENT_PACKAGE_NAME, CLIENT_VERSION, CONTRACT_VERSION, PROTOCOL_VERSION } from "../version.js";
import { loadUpgradeState, saveUpgradeState, setUpgradePhase } from "./state.js";

export interface UpgradeCheckResult {
  currentVersion: string;
  policy: VersionPolicy;
  upgradeRequired: boolean;
  upgradeRecommended: boolean;
  targetVersion: string;
}

export async function checkUpgrade(client: CoordinatorClient): Promise<UpgradeCheckResult> {
  const policy = await client.getVersionPolicy();
  const targetVersion = policy.recommendedClientVersion || policy.minimumClientVersion;
  const result = {
    currentVersion: CLIENT_VERSION,
    policy,
    upgradeRequired: compareSemver(CLIENT_VERSION, policy.minimumClientVersion) < 0,
    upgradeRecommended: compareSemver(CLIENT_VERSION, targetVersion) < 0,
    targetVersion,
  };
  saveUpgradeState({ ...loadUpgradeState(), currentVersion: CLIENT_VERSION, targetVersion, phase: "check" });
  return result;
}

export async function applyUpgrade(input: { client: CoordinatorClient; profile: ClientProfile; targetVersion?: string; confirm?: boolean; drainTimeoutMs?: number }): Promise<Record<string, unknown>> {
  if (!input.confirm) {
    throw new Error("Upgrade requires --confirm because it pauses duties and replaces the installed CLI package.");
  }
  const principalId = input.profile.principalId;
  if (!principalId) throw new Error("No principal configured; cannot pause agent duties before upgrade.");

  const check = await checkUpgrade(input.client);
  const targetVersion = input.targetVersion ?? check.targetVersion;
  setUpgradePhase("pause-chain", { targetVersion });
  const pauseReceipt = await input.client.submitActionIntent({
    type: "RequestAgentDutyPause",
    principalId,
    payload: { principalId, reason: `auto-upgrade to ${targetVersion}` },
  });
  setUpgradePhase("drain", { pausedAt: new Date().toISOString(), targetVersion });
  await waitForDrain(input.client, principalId, input.drainTimeoutMs ?? 120000);
  setUpgradePhase("install", { drainedAt: new Date().toISOString(), targetVersion });
  await execa("npm", ["install", "-g", `${CLIENT_PACKAGE_NAME}@${targetVersion}`], { stdio: "inherit" });
  setUpgradePhase("verify", { upgradedAt: new Date().toISOString(), targetVersion });
  const policy = await input.client.getVersionPolicy();
  if (compareSemver(targetVersion, policy.minimumClientVersion) < 0) {
    setUpgradePhase("maintenance", { rollbackReason: `Installed target ${targetVersion} is still below minimum ${policy.minimumClientVersion}` });
    return { status: "maintenance", targetVersion, pauseReceipt, policy };
  }
  if (input.profile.agentId) {
    await input.client.sendAgentHeartbeat(input.profile.agentId, {
      clientVersion: targetVersion,
      daemonVersion: targetVersion,
      contractVersion: CONTRACT_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      availability: "paused",
      upgradePhase: "verify",
    });
  }
  setUpgradePhase("resume-chain", { targetVersion });
  const resumeReceipt = await input.client.submitActionIntent({
    type: "ResumeAgentDuty",
    principalId,
    payload: { principalId },
  });
  const finalState = setUpgradePhase("complete", { currentVersion: targetVersion, targetVersion });
  return { status: "complete", targetVersion, pauseReceipt, resumeReceipt, state: finalState };
}

async function waitForDrain(client: CoordinatorClient, principalId: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const inbox = await client.getAgentInbox(principalId, { limit: 20 }).catch(() => undefined);
    const pending = [
      ...(inbox?.availableTasks ?? []),
      ...(inbox?.assignmentOffers ?? []),
      ...(inbox?.reviewRequests ?? []),
    ];
    if (pending.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  setUpgradePhase("maintenance", { rollbackReason: "Timed out waiting for in-flight work to drain" });
  throw new Error("Timed out waiting for in-flight work to drain; agent remains paused for manual recovery.");
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i += 1) {
    const diff = pa[i] - pb[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

function parseSemver(value: string): [number, number, number] {
  const clean = value.trim().replace(/^v/, "").split(/[+-]/)[0] ?? "";
  const parts = clean.split(".").map((part) => Number.parseInt(part, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}
