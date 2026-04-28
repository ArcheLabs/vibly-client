import { z } from "zod";

export const ClaimWorkOrderSchema = z.object({
  leaseMs: z.number().int().positive().optional(),
});

export const SubmitWorkOrderSchema = z.object({
  summary: z.string().min(1),
  contextBundleId: z.string().min(1),
  artifacts: z.array(z.object({
    uri: z.string(),
    mimeType: z.string().optional(),
    sha256: z.string().optional(),
    label: z.string().optional(),
  })).optional(),
});

export type ClaimWorkOrderInput = z.infer<typeof ClaimWorkOrderSchema>;
export type SubmitWorkOrderInput = z.infer<typeof SubmitWorkOrderSchema>;
