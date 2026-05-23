import { z } from "zod";

const capsuleTaskSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  deadlineAt: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

const previousSubmissionSchema = z.object({
  submissionId: z.string(),
  submittedAt: z.string(),
  summary: z.string().optional(),
  reviewSummary: z.string().optional(),
  reviewOutcome: z.enum(["approved", "rejected", "revision_required", "pending"]).optional(),
});

const memoryMountRequestSchema = z.object({
  scope: z.enum(["agent_private", "organization"]),
  ownerId: z.string(),
  label: z.string().optional(),
});

const capsulePermissionsSchema = z.object({
  readPaths: z.array(z.string()),
  writePaths: z.array(z.string()),
  networkAccess: z.boolean(),
  subProcesses: z.boolean(),
});

export const capsuleManifestSchema = z.object({
  version: z.literal("0.1"),
  taskId: z.string(),
  localAgentId: z.string().optional(),
  capsuleDir: z.string(),
  status: z.enum(["pending", "prepared", "running", "completed", "failed"]),
  task: capsuleTaskSchema,
  previousSubmissions: z.array(previousSubmissionSchema),
  memoryMounts: z.array(memoryMountRequestSchema),
  permissions: capsulePermissionsSchema,
  createdAt: z.string(),
  preparedAt: z.string().optional(),
  executorId: z.string().optional(),
});

const capsuleArtifactSchema = z.object({
  relativePath: z.string(),
  absolutePath: z.string(),
  mediaType: z.string().optional(),
  hash: z.string().optional(),
  sizeBytes: z.number().optional(),
});

export const capsuleSubmissionSchema = z.object({
  taskId: z.string(),
  localAgentId: z.string().optional(),
  summary: z.string(),
  artifacts: z.array(capsuleArtifactSchema),
  structuredResult: z.record(z.unknown()).optional(),
  executorId: z.string().optional(),
  completedAt: z.string(),
});
