import { describe, expect, it } from "vitest";
import { planDeterministicActions } from "./deterministicAgent.js";

describe("planDeterministicActions", () => {
  it("accepts observation assignments and submits an observation", () => {
    const actions = planDeterministicActions(
      {
        id: "observer-agent-1",
        principalId: "principal_observer_1",
        roleHints: ["observer"],
        skills: {},
        behavior: { allowReview: true },
      },
      {
        assignmentOffers: [{ id: "assign_1", observationTaskId: "obstask_1", status: "offered" }],
        knowledgeSnapshot: { entries: [{ title: "literature-index-empty.md" }] },
      },
    );

    expect(actions.map((action) => action.type)).toEqual(["RespondAssignmentOffer", "SubmitObservationResult"]);
  });

  it("keeps lazy agents silent", () => {
    const actions = planDeterministicActions(
      {
        id: "lazy-agent",
        principalId: "principal_lazy",
        roleHints: ["observer"],
        skills: {},
        behavior: { lazy: true },
      },
      { assignmentOffers: [{ id: "assign_1", status: "offered" }] },
    );

    expect(actions).toEqual([]);
  });
});
