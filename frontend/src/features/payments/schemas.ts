import { z } from "zod";
import { optionalPositiveMoney, positiveMoney } from "@/utils/schemas";

const methods = ["cash", "upi", "card", "corporate_credit"] as const;
const settleMethods = ["cash", "upi", "card"] as const;

const needsReference = (method: string) => method === "upi" || method === "card";
const REFERENCE_MESSAGE = "A transaction reference is required for UPI and card";

export const paymentSchema = z
  .object({
    method: z.enum(methods),
    /** Blank means "pay the full remaining balance"; the backend works that out. */
    amount: optionalPositiveMoney,
    transaction_id: z.string().trim().max(100, "At most 100 characters"),
  })
  .refine((v) => !needsReference(v.method) || v.transaction_id !== "", { message: REFERENCE_MESSAGE, path: ["transaction_id"] });
export type PaymentValues = z.infer<typeof paymentSchema>;

export const settlementSchema = z
  .object({
    method: z.enum(settleMethods),
    amount: positiveMoney,
    transaction_id: z.string().trim().max(100, "At most 100 characters"),
    note: z.string().trim().max(255, "At most 255 characters"),
  })
  .refine((v) => !needsReference(v.method) || v.transaction_id !== "", { message: REFERENCE_MESSAGE, path: ["transaction_id"] });
export type SettlementValues = z.infer<typeof settlementSchema>;
