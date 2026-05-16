import { describe, expect, it } from "vitest";
import {
  planLlmVibingMathActions,
  stableActionKey,
  stableIdempotencyKey,
  type LlmChat,
} from "./llmVibingMathAgent.js";

const llm: LlmChat = {
  async complete(system: string): Promise<string> {
    if (system.includes("Return only valid JSON")) {
      return JSON.stringify({
        title: "Build Literature Index",
        body: "Create a reusable Goldbach literature index.",
        suggestedTaskPlan: [{ title: "Draft index", description: "Curate five entries.", skillRequirements: ["literature_review"] }],
      });
    }
    return "LLM generated content";
  },
};

describe("planLlmVibingMathActions", () => {
  it("accepts an assignment and submits LLM observation content", async () => {
    const actions = await planLlmVibingMathActions({
      agent: { id: "observer-agent-1", principalId: "principal_observer_1", capabilities: ["observer"] },
      llm,
      inbox: {
        principalId: "principal_observer_1",
        assignmentOffers: [{ id: "assign_1", observationTaskId: "obstask_1", status: "offered" }],
        knowledgeSnapshot: { entries: [{ title: "project-status.md", content: "Bootstrap phase." }] },
      },
    });

    expect(actions.map((action) => action.intent.type)).toEqual(["RespondAssignmentOffer", "SubmitObservationResult"]);
    expect(actions[1]?.intent.payload["content"]).toBe("LLM generated content");
  });

  it("plans proposals only for proposer-capable agents", async () => {
    const actions = await planLlmVibingMathActions({
      agent: { id: "proposer-agent", principalId: "principal_proposer", capabilities: ["proposal_writing"] },
      llm,
      inbox: {
        principalId: "principal_proposer",
        notifications: [{
          id: "note_1",
          type: "ProposalCreationRequest",
          status: "open",
          organizationId: "org_1",
          projectId: "proj_1",
          payload: { discussionId: "disc_1" },
        }],
      },
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.intent.type).toBe("SubmitProposal");
    expect(actions[0]?.intent.payload["title"]).toBe("Build Literature Index");
  });
});

describe("stable idempotency", () => {
  it("creates a deterministic UUID-shaped key from a semantic action key", () => {
    const key = stableActionKey("principal", "SubmitReview", "review_1");
    expect(stableIdempotencyKey(key)).toBe(stableIdempotencyKey(key));
    expect(stableIdempotencyKey(key)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
