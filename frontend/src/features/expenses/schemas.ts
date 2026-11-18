import { z } from "zod";
import { positiveMoney } from "@/utils/schemas";

export const expenseSchema = z.object({
  category_id: z.string().min(1, "Choose a category"),
  description: z.string().trim().min(2, "At least 2 characters").max(255, "At most 255 characters"),
  amount: positiveMoney,
  expense_date: z.string().min(1, "Choose a date"),
});
export type ExpenseValues = z.infer<typeof expenseSchema>;

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80, "At most 80 characters"),
  description: z.string().trim().max(500, "At most 500 characters"),
});
export type ExpenseCategoryValues = z.infer<typeof expenseCategorySchema>;
