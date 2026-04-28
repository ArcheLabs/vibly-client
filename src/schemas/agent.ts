import { z } from "zod";

export const RegisterAgentSchema = z.object({
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  eligibleRoles: z.array(z.string()).optional(),
});

export const CreateRuntimeBindingSchema = z.object({
  runtimeKind: z.string().min(1),
  capabilities: z.array(z.string()).optional(),
});

export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>;
export type CreateRuntimeBindingInput = z.infer<typeof CreateRuntimeBindingSchema>;
