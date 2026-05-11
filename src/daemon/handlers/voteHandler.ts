import { randomUUID } from "node:crypto";
import type { CoordinatorClient } from "../../coordinator/client.js";
import type { ClientProfile } from "../../domain/clientTypes.js";
import type { DaemonConfig } from "../../schemas/daemon.js";
import { getLogger } from "../../config/logger.js";

export async function voteHandler(
  client: CoordinatorClient,
  profile: ClientProfile,
  daemonConfig: DaemonConfig,
): Promise<void> {
  if (!daemonConfig.autoVote) return;
  const log = getLogger();
  const agentId = profile.agentId;
  const principalId = profile.principalId;
  if (!agentId || !principalId) return;

  try {
    const result = await client.listNegotiations({ status: "open", projectId: profile.projectId, limit: 20 });
    for (const neg of result.items) {
      const riskLevel = (neg as { riskLevel?: string }).riskLevel ?? "low";
      if (riskLevel === "high" || riskLevel === "critical") continue;

      const topic = (neg as { topic?: string }).topic ?? "";
      const matchingRule = daemonConfig.autoVoteRules.find((rule) => {
        if (!rule.topicPattern) return true;
        try {
          return new RegExp(rule.topicPattern, "i").test(topic);
        } catch {
          return topic.includes(rule.topicPattern);
        }
      });

      if (!matchingRule) continue;

      log.info({ negotiationId: neg.id, stance: matchingRule.stance }, "daemon: submitting vote");
      await client.submitActionIntent({
        type: "SubmitNegotiationPosition",
        principalId,
        projectId: profile.projectId,
        payload: {
          negotiationId: neg.id,
          actorId: agentId,
          stance: matchingRule.stance,
          rationale: "Automatic vote by vibly-client daemon",
        },
        idempotencyKey: randomUUID(),
      });
    }
  } catch (e) {
    log.warn({ err: String(e) }, "daemon: voteHandler error");
  }
}
