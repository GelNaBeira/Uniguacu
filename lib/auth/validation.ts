import { z } from "zod";
export const emailSchema = z.string().trim().email();
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(4096) });
export const resetSchema = z.object({ password: z.string().min(8).max(4096), confirmation: z.string() }).refine((v) => v.password === v.confirmation);