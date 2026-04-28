import { z } from "zod";

export const RegisterRuntimeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  runtimeType: z.enum(["script", "mock", "human-assisted"]).default("script"),
  command: z.string().optional(),
  env: z.record(z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  capabilities: z.array(z.string()).optional(),
  agentId: z.string().optional(),
  runtimeBindingId: z.string().optional(),
});

export type RegisterRuntimeInput = z.infer<typeof RegisterRuntimeSchema>;
