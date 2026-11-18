import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username").max(50),
  password: z.string().min(1, "Enter your password").max(128),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
