import { randomUUID } from "node:crypto";
import type { CoordinatorClient } from "../../coordinator/client.js";
import type { ClientProfile } from "../../domain/clientTypes.js";
import type { DaemonConfig } from "../../schemas/daemon.js";
import { getLogger } from "../../config/logger.js";
import { planDeterministicActions, type DeterministicAgentConfig } from "../../e2e/deterministicAgent.js";

const submittedActionKeys = new Set<string>();

export async function deterministicE2eHandler(
  client: CoordinatorClient,
  profile: ClientProfile,
  daemonConfig: DaemonConfig,
): Promise<void> {
  if (!daemonConfig.deterministicE2E) return;
  const principalId = profile.principalId;
  if (!principalId) return;
  const log = getLogger();

  try {
    const inbox = await client.getAgentInbox(principalId, { projectId: profile.projectId, limit: 50 });
    const config = toDeterministicConfig(profile, inbox.agent);
    const actions = planDeterministicActions(config, inbox);
    const artifactByTask = new Map<string, string>();
    for (const action of actions) {
      const actionKey = `${action.principalId}:${action.type}:${JSON.stringify(action.payload)}`;
      if (submittedActionKeys.has(actionKey)) continue;
      log.info({ type: action.type, principalId }, "daemon: submitting deterministic action");
      const payload = { ...action.payload };
      if (action.type === "SubmitTask") {
        const taskId = String(payload["taskId"] ?? "");
        const artifactId = artifactByTask.get(taskId);
        if (artifactId && !Array.isArray(payload["artifactIds"])) payload["artifactIds"] = [artifactId];
      }
      const receipt = await client.submitActionIntent({
        ...action,
        payload,
        projectId: profile.projectId,
        idempotencyKey: randomUUID(),
      });
      submittedActionKeys.add(actionKey);
      if (action.type === "SubmitArtifact") {
        const taskId = String(action.payload["taskId"] ?? "");
        if (taskId) artifactByTask.set(taskId, receipt.aggregateRef.id);
      }
    }
  } catch (e) {
    log.warn({ err: String(e) }, "daemon: deterministicE2eHandler error");
  }
}

function toDeterministicConfig(profile: ClientProfile, agent?: Record<string, unknown>): DeterministicAgentConfig {
  const name = String(agent?.displayName ?? profile.name);
  const capabilities = Array.isArray(agent?.capabilities) ? agent.capabilities.map(String) : [];
  return {
    id: name,
    principalId: profile.principalId ?? name,
    roleHints: capabilities.length > 0 ? capabilities : [name],
    skills: Object.fromEntries(capabilities.map((capability) => [capability, 1])),
    behavior: {
      lazy: name.includes("lazy"),
      allowAutonomousProposal: name.includes("proposer"),
      allowTaskClaim: name.includes("researcher") || capabilities.includes("research"),
      allowReview: name.includes("reviewer") || capabilities.includes("review") || capabilities.includes("artifact_review"),
    },
  };
}
