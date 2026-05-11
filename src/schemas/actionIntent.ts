import { z } from "zod";

export const ActionIntentTypeSchema = z.enum([
  // Organization / Authority
  "CreateOrganization",
  "UpdateHandbook",
  "AddMember",
  "RemoveMember",
  "AssignGuardian",
  "GrantAuthority",
  "RevokeAuthority",
  "VetoProposal",
  "EmergencyPause",
  "EmergencyResume",
  // Observation
  "CreateObservation",
  "CreateObservationTask",
  "RespondAssignmentOffer",
  "SubmitObservationResult",
  // Discussion
  "StartDiscussion",
  "AddComment",
  "CloseDiscussionWithOutcome",
  "CreateDiscussionRound",
  "SubmitDiscussionContribution",
  // Proposal / Voting
  "SubmitProposal",
  "CreateVotingRound",
  "SubmitVote",
  // Task / Artifact
  "ClaimTask",
  "SubmitTask",
  "SubmitArtifact",
  // Review
  "SubmitReview",
  // Reward / Settlement
  "CreateRewardIntent",
  "SubmitSettlement",
  // Human / Request
  "AnswerRequest",
]);

export type ActionIntentType = z.infer<typeof ActionIntentTypeSchema>;

export const ActionIntentInputSchema = z.object({
  type: ActionIntentTypeSchema,
  principalId: z.string().min(1),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().uuid().optional(),
});

export type ActionIntentInput = z.infer<typeof ActionIntentInputSchema>;

export const ActionIntentReceiptSchema = z.object({
  eventId: z.string(),
  aggregateRef: z.object({ kind: z.string(), id: z.string() }),
  status: z.literal("accepted"),
  events: z.array(z.unknown()),
});

export type ActionIntentReceipt = z.infer<typeof ActionIntentReceiptSchema>;
