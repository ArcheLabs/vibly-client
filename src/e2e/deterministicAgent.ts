export interface DeterministicAgentConfig {
  id: string;
  principalId: string;
  roleHints: string[];
  skills: Record<string, number>;
  behavior: {
    allowAutonomousProposal?: boolean;
    allowTaskClaim?: boolean;
    allowReview?: boolean;
    lazy?: boolean;
  };
}

export interface DeterministicInbox {
  assignmentOffers?: Array<Record<string, unknown>>;
  discussionParticipations?: Array<Record<string, unknown>>;
  reviewRequests?: Array<Record<string, unknown>>;
  availableTasks?: Array<Record<string, unknown>>;
  notifications?: Array<Record<string, unknown>>;
  knowledgeSnapshot?: { entries?: Array<Record<string, unknown>> };
}

export interface DeterministicActionIntent {
  type: string;
  principalId: string;
  payload: Record<string, unknown>;
}

export function planDeterministicActions(
  agent: DeterministicAgentConfig,
  inbox: DeterministicInbox,
): DeterministicActionIntent[] {
  if (agent.behavior.lazy) return [];

  const actions: DeterministicActionIntent[] = [];
  const principalId = agent.principalId;

  for (const offer of inbox.assignmentOffers ?? []) {
    if (offer.status === "offered" && typeof offer.id === "string") {
      actions.push({
        type: "RespondAssignmentOffer",
        principalId,
        payload: { assignmentId: offer.id, response: "accept" },
      });
      if (typeof offer.observationTaskId === "string") {
        actions.push({
          type: "SubmitObservationResult",
          principalId,
          payload: {
            observationTaskId: offer.observationTaskId,
            tags: ["missing_infrastructure", "literature_index"],
            content: observationContent(inbox),
          },
        });
      }
    }
  }

  for (const discussion of inbox.discussionParticipations ?? []) {
    const round = Array.isArray(discussion.rounds) ? discussion.rounds[0] as Record<string, unknown> | undefined : undefined;
    if (typeof discussion.id === "string" && typeof round?.index === "number") {
      actions.push({
        type: "SubmitDiscussionContribution",
        principalId,
        payload: {
          discussionId: discussion.id,
          roundIndex: round.index,
          content: "The literature index is the right bootstrap artifact and should become a proposal with reviewable tasks.",
        },
      });
    }
  }

  if (agent.behavior.allowReview) {
    for (const review of inbox.reviewRequests ?? []) {
      if (typeof review.id === "string") {
        actions.push({
          type: "SubmitReview",
          principalId,
          payload: {
            reviewRoundId: review.id,
            outcome: "accepted",
            comment: "decision=accept score=0.9 reason=meets deterministic E2E acceptance criteria risk=low",
          },
        });
      }
    }
  }

  if (agent.behavior.allowTaskClaim) {
    for (const task of inbox.availableTasks ?? []) {
      if (task.status === "available" && typeof task.id === "string" && typeof task.organizationId === "string") {
        actions.push({
          type: "ClaimTask",
          principalId,
          payload: { organizationId: task.organizationId, taskId: task.id },
        });
      }
    }
  }

  return actions;
}

function observationContent(inbox: DeterministicInbox): string {
  const entries = inbox.knowledgeSnapshot?.entries ?? [];
  const hasIndex = entries.some((entry) => String(entry.title ?? entry.content ?? "").includes("Literature Index v0.1"));
  if (hasIndex) {
    return "Literature Index v0.1 already exists. The next observation should expand it and add taxonomy rather than recreate the first index.";
  }
  return [
    "Current knowledge says the project is in bootstrap phase.",
    "The literature-index entry says no structured Literature Index exists yet.",
    "The correct next step is to create Goldbach Literature Index v0.1 as reusable research infrastructure.",
  ].join("\n");
}
