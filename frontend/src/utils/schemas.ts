import { z } from "zod";

/** Amounts are validated as text with at most 2 decimals; the backend does the real checks. */
export const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 120 or 120.50");

export const positiveMoney = moneyString.refine((v) => Number(v) > 0, "Amount must be greater than zero");

const MONEY_RE = /^\d{1,10}(\.\d{1,2})?$/;

/** An amount that may be left blank (""), otherwise it must look like money. Avoids z.union so the message stays readable. */
export const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === "" || MONEY_RE.test(v), "Enter an amount like 120 or 120.50");

/** Blank, or a positive amount. */
export const optionalPositiveMoney = optionalMoney.refine((v) => v === "" || Number(v) > 0, "Amount must be greater than zero");

/** Whole number kept as a string so react-hook-form stays simply typed; convert when building the payload. */
export const wholeNumber = (max = 1_000_000) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number")
    .refine((v) => Number(v) <= max, `Must be ${max.toLocaleString("en-IN")} or less`);

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,49}$/;

export const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "3–50 characters: lowercase letters, digits, '.', '_' or '-'");

export const phoneField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, "Enter a phone number with 7–15 digits"));

export const passwordField = z
  .string()
  .min(10, "At least 10 characters")
  .max(128, "At most 128 characters")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use at least one letter and one digit");
