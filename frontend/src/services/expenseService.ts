import type { Page } from "@/types/common";
import type {
  Expense,
  ExpenseCategory,
  ExpenseCategoryInput,
  ExpenseInput,
  ExpenseListQuery,
} from "@/types/finance";
import { apiClient } from "./apiClient";

export const expenseService = {
  categories: () => apiClient.get<ExpenseCategory[]>("/expense-categories"),
  createCategory: (body: ExpenseCategoryInput) =>
    apiClient.post<ExpenseCategory>("/expense-categories", body),
  list: (query?: ExpenseListQuery) => apiClient.get<Page<Expense>>("/expenses", { query }),
  create: (body: ExpenseInput) => apiClient.post<Expense>("/expenses", body),
  update: (id: string, body: Partial<ExpenseInput>) => apiClient.patch<Expense>(`/expenses/${id}`, body),
  remove: (id: string) => apiClient.delete(`/expenses/${id}`),
};
