import { z } from "zod";
import { passwordField, usernameField } from "@/utils/schemas";

const fullName = z.string().trim().min(2, "At least 2 characters").max(120, "At most 120 characters");

export const userCreateSchema = z.object({
  username: usernameField,
  full_name: fullName,
  role: z.enum(["owner", "manager", "cashier"]),
  password: passwordField,
});
export type UserCreateValues = z.infer<typeof userCreateSchema>;

export const userEditSchema = z.object({
  full_name: fullName,
  role: z.enum(["owner", "manager", "cashier"]),
  status: z.enum(["active", "inactive"]),
});
export type UserEditValues = z.infer<typeof userEditSchema>;

export const resetPasswordSchema = z.object({ new_password: passwordField });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
