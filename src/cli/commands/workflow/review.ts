import type { Command } from "commander";
import { requireAgentId } from "../../../config/profiles.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import type { ReviewRecord } from "../../../coordinator/types.js";

import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
export function registerReviewCommands(program: Command): void {
  const review = program.command("review").description("Manage reviews");

  review
    .command("list")
    .description("List review requests")
    .option("--result <result>", "Filter by result (approve|reject|request-changes)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const agentId = profile.agentId;
        const result = await client.listReviews({
          reviewerId: agentId,
          result: opts.result as string | undefined,
          limit: 50,
        });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as ReviewRecord[];
          if (arr.length === 0) return "No reviews found";
          return arr.map((r) => `  ${r.id}  ${r.result ?? "pending"}  (${r.reviewerId ?? ""})`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  review
    .command("submit")
    .description("Submit a review")
    .requiredOption("--submission-id <id>", "Submission ID to review")
    .requiredOption("--result <result>", "Result: approve|reject|request-changes|abstain")
    .requiredOption("--rationale <text>", "Review rationale")
    .requiredOption("--context-bundle-id <id>", "Context bundle ID used for review")
    .option("--score <n>", "Score 0-1")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const agentId = requireAgentId(profile);
        const r = await client.submitReview({
          target: { kind: "submission", submissionId: opts.submissionId as string },
          reviewerId: agentId,
          result: opts.result as string,
          rationale: opts.rationale as string,
          contextBundleId: opts.contextBundleId as string,
          score: opts.score ? parseFloat(opts.score as string) : undefined,
          evidence: [],
        });
        printOutput(outputOk(r), Boolean(opts.json), () => `Review submitted: ${r.id}`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
