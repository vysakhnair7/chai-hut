import { z } from "zod";
import { passwordField } from "@/utils/schemas";

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password").max(128),
    new_password: passwordField,
    confirm_password: z.string().min(1, "Repeat the new password"),
  })
  .refine((v) => v.new_password === v.confirm_password, { message: "Passwords do not match", path: ["confirm_password"] })
  .refine((v) => v.new_password !== v.current_password, { message: "Choose a different password", path: ["new_password"] });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
