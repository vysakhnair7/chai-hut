import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { expenseService } from "@/services/expenseService";
import type { ExpenseCategoryInput, ExpenseInput, ExpenseListQuery } from "@/types/finance";

const EXPENSE_KEYS = [["expenses"], ["report-financial"]];

export function useExpenseCategories() {
  return useQuery({ queryKey: queryKeys.expenseCategories, queryFn: expenseService.categories });
}

export function useExpenses(query: ExpenseListQuery) {
  return useQuery({
    queryKey: queryKeys.expenses(query),
    queryFn: () => expenseService.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useCreateExpense(onDone?: () => void) {
  return useApiMutation((body: ExpenseInput) => expenseService.create(body), {
    success: "Expense added",
    invalidate: EXPENSE_KEYS,
    toastError: false,
    onSuccess: onDone,
  });
}

export function useUpdateExpense(id: string, onDone?: () => void) {
  return useApiMutation((body: Partial<ExpenseInput>) => expenseService.update(id, body), {
    success: "Expense updated",
    invalidate: EXPENSE_KEYS,
    toastError: false,
    onSuccess: onDone,
  });
}

export function useDeleteExpense(onDone?: () => void) {
  return useApiMutation((id: string) => expenseService.remove(id), {
    success: "Expense deleted",
    invalidate: EXPENSE_KEYS,
    onSuccess: onDone,
  });
}

export function useCreateExpenseCategory(onDone?: () => void) {
  return useApiMutation((body: ExpenseCategoryInput) => expenseService.createCategory(body), {
    success: "Category added",
    invalidate: [queryKeys.expenseCategories],
    toastError: false,
    onSuccess: onDone,
  });
}
