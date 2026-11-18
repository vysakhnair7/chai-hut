import { z } from "zod";
import { moneyString, optionalMoney, wholeNumber } from "@/utils/schemas";

const name = z.string().trim().min(2, "At least 2 characters").max(120, "At most 120 characters");
const description = z.string().trim().max(1000, "At most 1000 characters");
const percent = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100), "Enter 0–100, up to 2 decimals");

export const productCreateSchema = z.object({
  category_id: z.string().min(1, "Choose a category"),
  name,
  description,
  mrp: moneyString,
  cost_price: optionalMoney,
  gst_rate: percent,
  stock_quantity: wholeNumber(),
});
export type ProductCreateValues = z.infer<typeof productCreateSchema>;

export const productEditSchema = z.object({
  category_id: z.string().min(1, "Choose a category"),
  name,
  description,
  gst_rate: percent,
  status: z.enum(["available", "out_of_stock", "discontinued"]),
});
export type ProductEditValues = z.infer<typeof productEditSchema>;

export const priceSchema = z
  .object({ mrp: optionalMoney, cost_price: optionalMoney })
  .refine((v) => v.mrp !== "" || v.cost_price !== "", { message: "Enter a selling price or a cost price", path: ["mrp"] });
export type PriceValues = z.infer<typeof priceSchema>;

export const stockSchema = z.object({ stock_quantity: wholeNumber() });
export type StockValues = z.infer<typeof stockSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80, "At most 80 characters"),
  description: z.string().trim().max(500, "At most 500 characters"),
});
export type CategoryValues = z.infer<typeof categorySchema>;
