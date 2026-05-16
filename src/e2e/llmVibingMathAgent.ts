import { createHash } from "node:crypto";
import type { AgentInbox, ActionIntentInput } from "../domain/clientTypes.js";

export interface LlmAgentConfig {
  id: string;
  principalId: string;
  capabilities: string[];
}

export interface LlmChat {
  complete(system: string, user: string): Promise<string>;
}

export interface PlannedLlmAction {
  key: string;
  intent: ActionIntentInput;
  artifactTaskId?: string;
}

type Json = Record<string, unknown>;

export async function planLlmVibingMathActions(input: {
  agent: LlmAgentConfig;
  inbox: AgentInbox;
  llm: LlmChat;
}): Promise<PlannedLlmAction[]> {
  const { agent, inbox, llm } = input;
  const actions: PlannedLlmAction[] = [];

  for (const offer of inbox.assignmentOffers ?? []) {
    const status = String(offer["status"] ?? "");
    const assignmentId = stringValue(offer["id"]);
    const observationTaskId = stringValue(offer["observationTaskId"]);
    if (!assignmentId || !observationTaskId) continue;

    if (status === "offered") {
      actions.push({
        key: stableActionKey(agent.principalId, "RespondAssignmentOffer", assignmentId),
        intent: {
          type: "RespondAssignmentOffer",
          principalId: agent.principalId,
          projectId: inboxProjectId(inbox),
          payload: { assignmentId, response: "accept" },
        },
      });
    }

    if (status === "offered" || status === "accepted") {
      const observationTask = asJson(offer["observationTask"]);
      const content = await generateObservation(llm, agent, inbox, observationTask);
      actions.push({
        key: stableActionKey(agent.principalId, "SubmitObservationResult", observationTaskId),
        intent: {
          type: "SubmitObservationResult",
          principalId: agent.principalId,
          projectId: inboxProjectId(inbox),
          payload: {
            observationTaskId,
            content,
            tags: ["live_llm", "vibing_math"],
          },
        },
      });
    }
  }

  for (const discussion of inbox.discussionParticipations ?? []) {
    const discussionId = stringValue(discussion["id"]);
    const round = Array.isArray(discussion["rounds"]) ? asJson(discussion["rounds"][0]) : undefined;
    const roundIndex = typeof round?.["index"] === "number" ? round["index"] as number : 0;
    const contributions = Array.isArray(round?.["contributions"]) ? round?.["contributions"] as Json[] : [];
    const alreadyContributed = contributions.some((item) => item["authorId"] === agent.principalId);
    if (!discussionId || alreadyContributed) continue;

    const contribution = await generateDiscussionContribution(llm, agent, inbox, discussion);
    actions.push({
      key: stableActionKey(agent.principalId, "SubmitDiscussionContribution", `${discussionId}:${roundIndex}`),
      intent: {
        type: "SubmitDiscussionContribution",
        principalId: agent.principalId,
        projectId: inboxProjectId(inbox),
        payload: { discussionId, roundIndex, content: contribution },
      },
    });

    if (!discussion["outcome"] && canPropose(agent)) {
      const summary = await generateDiscussionOutcome(llm, agent, inbox, discussion);
      actions.push({
        key: stableActionKey(agent.principalId, "CloseDiscussionWithOutcome", discussionId),
        intent: {
          type: "CloseDiscussionWithOutcome",
          principalId: agent.principalId,
          projectId: inboxProjectId(inbox),
          payload: { discussionId, outcome: "escalated", summary },
        },
      });
    }
  }

  if (canPropose(agent)) {
    for (const notification of inbox.notifications ?? []) {
      if (notification["type"] !== "ProposalCreationRequest" || notification["status"] !== "open") continue;
      const proposal = await generateProposal(llm, agent, inbox, notification);
      const notificationId = stringValue(notification["id"]) || JSON.stringify(notification);
      actions.push({
        key: stableActionKey(agent.principalId, "SubmitProposal", notificationId),
        intent: {
          type: "SubmitProposal",
          principalId: agent.principalId,
          projectId: stringValue(notification["projectId"]) || inboxProjectId(inbox),
          payload: {
            organizationId: notification["organizationId"],
            projectId: notification["projectId"],
            title: proposal.title,
            body: proposal.body,
            discussionRef: proposal.discussionRef,
            suggestedTaskPlan: proposal.suggestedTaskPlan,
          },
        },
      });
    }
  }

  if (canReview(agent)) {
    for (const review of inbox.reviewRequests ?? []) {
      const reviewRoundId = stringValue(review["id"]);
      if (!reviewRoundId) continue;
      const comment = await generateReview(llm, agent, inbox, review);
      actions.push({
        key: stableActionKey(agent.principalId, "SubmitReview", reviewRoundId),
        intent: {
          type: "SubmitReview",
          principalId: agent.principalId,
          projectId: inboxProjectId(inbox),
          payload: { reviewRoundId, outcome: "accepted", comment },
        },
      });
    }
  }

  if (canExecuteTasks(agent)) {
    for (const task of inbox.availableTasks ?? []) {
      const taskId = stringValue(task["id"]);
      const organizationId = stringValue(task["organizationId"]);
      if (!taskId || !organizationId) continue;

      if (task["status"] === "available") {
        actions.push({
          key: stableActionKey(agent.principalId, "ClaimTask", taskId),
          intent: {
            type: "ClaimTask",
            principalId: agent.principalId,
            projectId: inboxProjectId(inbox),
            payload: { organizationId, taskId },
          },
        });
      }

      if ((task["status"] === "claimed" || task["status"] === "in-progress") && task["assigneeId"] === agent.principalId) {
        const artifactContent = await generateArtifact(llm, agent, inbox, task);
        actions.push({
          key: stableActionKey(agent.principalId, "SubmitArtifact", taskId),
          artifactTaskId: taskId,
          intent: {
            type: "SubmitArtifact",
            principalId: agent.principalId,
            projectId: inboxProjectId(inbox),
            payload: {
              organizationId,
              taskId,
              title: String(task["title"] ?? "Live LLM Vibing Math Artifact"),
              mimeType: "text/markdown",
              contentRef: `inline://${taskId}-live-llm-artifact`,
              description: artifactContent,
              tags: ["live-llm", "vibing-math", "goldbach"],
            },
          },
        });
        actions.push({
          key: stableActionKey(agent.principalId, "SubmitTask", taskId),
          intent: {
            type: "SubmitTask",
            principalId: agent.principalId,
            projectId: inboxProjectId(inbox),
            payload: {
              organizationId,
              taskId,
              summary: "Live LLM daemon completed the assigned Vibing Math task.",
            },
          },
        });
      }
    }
  }

  return actions;
}

export function toLlmAgentConfig(profile: {
  name: string;
  principalId?: string;
}, inbox: AgentInbox): LlmAgentConfig | undefined {
  const principalId = profile.principalId;
  if (!principalId) return undefined;
  const agent = inbox.agent ?? {};
  const capabilities = Array.isArray(agent["capabilities"])
    ? agent["capabilities"].map(String)
    : [];
  return {
    id: String(agent["displayName"] ?? profile.name),
    principalId,
    capabilities,
  };
}

export function stableActionKey(principalId: string, type: string, target: string): string {
  return `${principalId}:${type}:${target}`;
}

export function stableIdempotencyKey(actionKey: string): string {
  const hex = createHash("sha256").update(actionKey).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  const variant = Number.parseInt(hex[16]!, 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`;
}

function canPropose(agent: LlmAgentConfig): boolean {
  return hasAny(agent, ["proposer", "proposal_writing"]) || agent.id.includes("proposer");
}

function canReview(agent: LlmAgentConfig): boolean {
  return hasAny(agent, ["reviewer", "artifact_review", "review"]) || agent.id.includes("reviewer");
}

function canExecuteTasks(agent: LlmAgentConfig): boolean {
  return hasAny(agent, ["researcher", "research", "literature_review", "structured_indexing"]) ||
    agent.id.includes("researcher");
}

function hasAny(agent: LlmAgentConfig, values: string[]): boolean {
  const caps = new Set(agent.capabilities.map((item) => item.toLowerCase()));
  return values.some((value) => caps.has(value));
}

async function generateObservation(
  llm: LlmChat,
  agent: LlmAgentConfig,
  inbox: AgentInbox,
  observationTask?: Json,
): Promise<string> {
  return llm.complete(
    `You are ${agent.id}, a live LLM observer in the Vibing Math organization. Reply in Markdown, 150-300 words, with concrete next actions.`,
    [
      `Observation task: ${JSON.stringify(observationTask ?? {})}`,
      `Knowledge snapshot:\n${knowledgeSnapshotText(inbox)}`,
      "Identify the most important project gap or next step. If a Literature Index already exists, do not propose recreating it.",
    ].join("\n\n"),
  );
}

async function generateDiscussionContribution(
  llm: LlmChat,
  agent: LlmAgentConfig,
  inbox: AgentInbox,
  discussion: Json,
): Promise<string> {
  return llm.complete(
    `You are ${agent.id}, a live LLM discussion participant. Be concise and decision-oriented.`,
    [
      `Discussion: ${JSON.stringify(discussion).slice(0, 2500)}`,
      `Knowledge snapshot:\n${knowledgeSnapshotText(inbox)}`,
      "Contribute one useful paragraph that helps the group converge on a proposal.",
    ].join("\n\n"),
  );
}

async function generateDiscussionOutcome(
  llm: LlmChat,
  agent: LlmAgentConfig,
  inbox: AgentInbox,
  discussion: Json,
): Promise<string> {
  return llm.complete(
    `You are ${agent.id}, a live LLM proposer closing a discussion. Reply with a concise outcome summary.`,
    [
      `Discussion: ${JSON.stringify(discussion).slice(0, 3000)}`,
      `Knowledge snapshot:\n${knowledgeSnapshotText(inbox)}`,
      "Summarize the agreed proposal direction and the concrete deliverables.",
    ].join("\n\n"),
  );
}

type ProposalData = {
  title: string;
  body: string;
  discussionRef?: { kind: string; id: string };
  suggestedTaskPlan: Array<{ title: string; description: string; skillRequirements: string[] }>;
};

async function generateProposal(
  llm: LlmChat,
  agent: LlmAgentConfig,
  inbox: AgentInbox,
  notification: Json,
): Promise<ProposalData> {
  const raw = await llm.complete(
    `You are ${agent.id}, a live LLM proposer. Return only valid JSON with keys title, body, suggestedTaskPlan.`,
    [
      `Proposal request: ${JSON.stringify(notification).slice(0, 2500)}`,
      `Knowledge snapshot:\n${knowledgeSnapshotText(inbox)}`,
      "Create 2-3 concrete tasks. The proposal should help the Goldbach Program build reusable research assets.",
    ].join("\n\n"),
  );
  const parsed = parseJsonObject(raw);
  const payload = asJson(notification["payload"]);
  const discussionId = stringValue(payload?.["discussionId"]);
  return {
    title: stringValue(parsed["title"]) || "Advance Goldbach Research Infrastructure",
    body: stringValue(parsed["body"]) || raw,
    discussionRef: discussionId ? { kind: "DiscussionThread", id: discussionId } : undefined,
    suggestedTaskPlan: normalizeTaskPlan(parsed["suggestedTaskPlan"]),
  };
}

async function generateReview(
  llm: LlmChat,
  agent: LlmAgentConfig,
  inbox: AgentInbox,
  review: Json,
): Promise<string> {
  return llm.complete(
    `You are ${agent.id}, a live LLM reviewer. Reply in one line: score=<0.0-1.0> decision=accept reason=<short reason> risk=<low|medium|high>.`,
    [
      `Review request: ${JSON.stringify(review).slice(0, 3000)}`,
      `Knowledge snapshot:\n${knowledgeSnapshotText(inbox)}`,
      "Review for coherence, usefulness, and whether it moves Vibing Math forward.",
    ].join("\n\n"),
  );
}

async function generateArtifact(
  llm: LlmChat,
  agent: LlmAgentConfig,
  inbox: AgentInbox,
  task: Json,
): Promise<string> {
  return llm.complete(
    `You are ${agent.id}, a live LLM researcher. Produce a complete Markdown artifact with specific, reusable research content.`,
    [
      `Task: ${JSON.stringify(task).slice(0, 2500)}`,
      `Knowledge snapshot:\n${knowledgeSnapshotText(inbox)}`,
      "If this is a literature index task, include at least five entries with title, authors, year, relevance, summary, and tags.",
    ].join("\n\n"),
  );
}

function normalizeTaskPlan(value: unknown): ProposalData["suggestedTaskPlan"] {
  if (Array.isArray(value) && value.length > 0) {
    return value.slice(0, 3).map((item, index) => {
      const record = asJson(item) ?? {};
      return {
        title: stringValue(record["title"]) || `Live LLM Task ${index + 1}`,
        description: stringValue(record["description"]) || "Produce a concrete Vibing Math research artifact.",
        skillRequirements: Array.isArray(record["skillRequirements"])
          ? record["skillRequirements"].map(String)
          : ["literature_review"],
      };
    });
  }
  return [
    {
      title: "Draft Goldbach Literature Index v0.1",
      description: "Curate core references, summaries, and relevance notes for the Goldbach Program.",
      skillRequirements: ["literature_review"],
    },
    {
      title: "Define Research Asset Schema",
      description: "Define reusable fields and review criteria for future Goldbach research assets.",
      skillRequirements: ["structured_indexing"],
    },
  ];
}

function parseJsonObject(raw: string): Json {
  const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
  try {
    return JSON.parse(cleaned) as Json;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Json;
      } catch {
        return {};
      }
    }
    return {};
  }
}

function knowledgeSnapshotText(inbox: AgentInbox): string {
  return (inbox.knowledgeSnapshot?.entries ?? [])
    .map((entry) => `## ${String(entry["title"] ?? "Untitled")}\n${String(entry["content"] ?? entry["summary"] ?? "").slice(0, 1600)}`)
    .join("\n\n")
    .slice(0, 7000);
}

function inboxProjectId(inbox: AgentInbox): string | undefined {
  const task = inbox.availableTasks?.[0];
  if (task && typeof task["projectId"] === "string") return task["projectId"];
  const notification = inbox.notifications?.[0];
  if (notification && typeof notification["projectId"] === "string") return notification["projectId"];
  return undefined;
}

function asJson(value: unknown): Json | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
