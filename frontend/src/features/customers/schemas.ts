import { z } from "zod";
import { phoneField, usernameField } from "@/utils/schemas";

const nameField = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const customerCreateSchema = z.object({
  username: usernameField,
  full_name: nameField("Name", 120),
  company_name: nameField("Company", 160),
  phone: phoneField,
});
export type CustomerCreateValues = z.infer<typeof customerCreateSchema>;

export const customerEditSchema = z.object({
  full_name: nameField("Name", 120),
  company_name: nameField("Company", 160),
  phone: phoneField,
  status: z.enum(["active", "inactive"]),
});
export type CustomerEditValues = z.infer<typeof customerEditSchema>;
