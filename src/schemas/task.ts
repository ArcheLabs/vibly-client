import { z } from "zod";

export const ClaimTaskSchema = z.object({
  leaseMs: z.number().int().positive().optional(),
});

export const SubmitArtifactSchema = z.object({
  summary: z.string().min(1),
  artifactUri: z.string().optional(),
  artifactHash: z.string().optional(),
  artifactMediaType: z.string().optional(),
  structuredResult: z.record(z.unknown()).optional(),
});

export type ClaimTaskInput = z.infer<typeof ClaimTaskSchema>;
export type SubmitArtifactInput = z.infer<typeof SubmitArtifactSchema>;
