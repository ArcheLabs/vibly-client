import { z } from "zod";

export const RegisterPrincipalSchema = z.object({
  kind: z.enum(["human", "organization", "agent", "system"]).default("human"),
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const BindAddressSchema = z.object({
  chain: z.string().min(1),
  address: z.string().min(1),
  publicKey: z.string().optional(),
  proof: z.string().optional(),
});

export type RegisterPrincipalInput = z.infer<typeof RegisterPrincipalSchema>;
export type BindAddressInput = z.infer<typeof BindAddressSchema>;
