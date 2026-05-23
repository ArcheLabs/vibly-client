import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { requirePrincipalId } from "../../../config/profiles.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
import { generateCapsule, loadManifest, updateManifest } from "../../../capsule/generator.js";
import { buildSubmission } from "../../../capsule/submission.js";
import { getWorkspaceDir, getArtifactsDir } from "../../../config/paths.js";

export function registerTaskCommands(program: Command): void {
  const task = program.command("task").description("Manage tasks (work orders)");

  task
    .command("list")
    .description("List available tasks")
    .option("--project-id <id>", "Filter by project ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await client.listAvailableTasks({
          projectId: (opts.projectId as string | undefined) ?? profile.projectId,
          limit: 50,
        });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as unknown[];
          if (arr.length === 0) return "No available tasks";
          return arr.map((t) => JSON.stringify(t)).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  task
    .command("claim <taskId>")
    .description("Claim a task")
    .option("--lease-ms <ms>", "Lease duration in milliseconds")
    .option("--json", "Output as JSON")
    .action(async (taskId: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const receipt = await client.submitActionIntent({
          type: "ClaimWorkOrder",
          principalId,
          projectId: profile.projectId,
          payload: {
            workOrderId: taskId,
            actorId: profile.agentId ?? principalId,
            leaseMs: opts.leaseMs ? parseInt(opts.leaseMs as string, 10) : undefined,
          },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Task claimed (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  task
    .command("submit <taskId>")
    .description("Submit task result")
    .requiredOption("--summary <text>", "Task summary")
    .option("--artifact-uri <uri>", "Artifact URI")
    .option("--artifact-hash <hash>", "Artifact hash")
    .option("--artifact-media-type <type>", "Artifact media type")
    .option("--json", "Output as JSON")
    .action(async (taskId: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const receipt = await client.submitActionIntent({
          type: "SubmitWorkOrder",
          principalId,
          projectId: profile.projectId,
          payload: {
            workOrderId: taskId,
            submittedBy: profile.agentId ?? principalId,
            summary: opts.summary as string,
            artifacts: opts.artifactUri
              ? [{ uri: opts.artifactUri as string, hash: opts.artifactHash as string | undefined, mediaType: opts.artifactMediaType as string | undefined }]
              : [],
          },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Task submitted (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  // ── Capsule-aware commands ────────────────────────────────────────────────

  task
    .command("inspect <taskId>")
    .description("Show task details from coordinator")
    .option("--json", "Output as JSON")
    .action(async (taskId: string, opts) => {
      try {
        const { client } = getCoordinatorClient();
        const t = await client.getTask(taskId);
        const manifest = loadManifest(taskId);
        const output = { task: t, capsule: manifest ?? null };
        printOutput(outputOk(output), Boolean(opts.json), (d) => {
          const o = d as typeof output;
          const task = o.task as Record<string, unknown>;
          const lines = [
            `  Task ID   : ${taskId}`,
            `  Kind      : ${String(task["kind"] ?? "?")}`,
            `  Title     : ${String(task["title"] ?? task["description"] ?? "(none)")}`,
            `  Status    : ${String(task["status"] ?? "?")}`,
            `  Deadline  : ${String(task["deadlineAt"] ?? "(none)")}`,
            `  Capsule   : ${o.capsule ? o.capsule.capsuleDir : "(not prepared)"}`,
          ];
          return lines.join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  task
    .command("prepare <taskId>")
    .description("Create a local capsule workspace for a task")
    .option("--local-agent-id <id>", "Local agent ID")
    .option("--force", "Overwrite existing capsule")
    .option("--json", "Output as JSON")
    .action(async (taskId: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const t = await client.getTask(taskId) as Record<string, unknown>;

        const manifest = generateCapsule({
          task: {
            id: taskId,
            kind: String(t["kind"] ?? "task"),
            title: t["title"] ? String(t["title"]) : undefined,
            description: t["description"] ? String(t["description"]) : undefined,
            organizationId: t["organizationId"] ? String(t["organizationId"]) : undefined,
            projectId: t["projectId"] ? String(t["projectId"] ?? profile.projectId) : undefined,
            deadlineAt: t["deadlineAt"] ? String(t["deadlineAt"]) : undefined,
            payload: t["payload"] as Record<string, unknown> | undefined,
          },
          localAgentId: opts.localAgentId as string | undefined,
          force: Boolean(opts.force),
        });

        printOutput(outputOk(manifest), Boolean(opts.json), (d) => {
          const m = d as typeof manifest;
          return [
            `  Capsule prepared for task: ${taskId}`,
            `  Directory  : ${m.capsuleDir}`,
            `  Task file  : ${m.capsuleDir}/task.md`,
            `  Artifacts  : ${getArtifactsDir(taskId)}`,
            ``,
            `  Run: vibly task run ${taskId}`,
          ].join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  task
    .command("run <taskId>")
    .description("Execute a prepared capsule using an executor adapter")
    .option("--executor <id>", "Executor adapter ID (generic-shell|codex|claude|auto)", "auto")
    .option("--timeout-ms <ms>", "Execution timeout in milliseconds")
    .option("--json", "Output as JSON")
    .action(async (taskId: string, opts) => {
      try {
        const manifest = loadManifest(taskId);
        if (!manifest) {
          process.stderr.write(`No capsule found for task ${taskId}. Run: vibly task prepare ${taskId}\n`);
          process.exitCode = 1;
          return;
        }

        updateManifest(taskId, { status: "running", executorId: opts.executor as string });

        const { runWithExecutor } = await import("../../../executors/registry.js");
        const result = await runWithExecutor({
          executorId: opts.executor as string,
          manifest,
          timeoutMs: opts.timeoutMs ? parseInt(opts.timeoutMs as string, 10) : undefined,
        });

        updateManifest(taskId, { status: result.status === "success" ? "completed" : "failed" });

        printOutput(outputOk(result), Boolean(opts.json), (d) => {
          const r = d as typeof result;
          return [
            `  Execution ${r.status}`,
            `  Summary: ${r.summary}`,
            `  Artifacts: ${r.artifactPaths.length} file(s) in ${getArtifactsDir(taskId)}`,
          ].join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  task
    .command("status <taskId>")
    .description("Show the current capsule status for a task")
    .option("--json", "Output as JSON")
    .action((taskId: string, opts) => {
      const manifest = loadManifest(taskId);
      if (!manifest) {
        process.stderr.write(`No capsule found for task ${taskId}.\n`);
        process.exitCode = 1;
        return;
      }
      printOutput(outputOk(manifest), Boolean(opts.json), (d) => {
        const m = d as typeof manifest;
        return [
          `  Task ID  : ${m.taskId}`,
          `  Status   : ${m.status}`,
          `  Created  : ${m.createdAt}`,
          `  Prepared : ${m.preparedAt ?? "(none)"}`,
          `  Executor : ${m.executorId ?? "(none)"}`,
          `  Dir      : ${m.capsuleDir}`,
        ].join("\n");
      });
    });

  task
    .command("build-submission <taskId>")
    .description("Collect artifacts and write submission.json (does not upload)")
    .requiredOption("--summary <text>", "Submission summary")
    .option("--json", "Output as JSON")
    .action((taskId: string, opts) => {
      try {
        const submission = buildSubmission({
          taskId,
          summary: opts.summary as string,
        });
        printOutput(outputOk(submission), Boolean(opts.json), (d) => {
          const s = d as typeof submission;
          return `  submission.json written — ${s.artifacts.length} artifact(s)`;
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
