import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FormDialog } from "@/components/common/FormDialog";
import { FormField } from "@/components/common/FormField";
import { Input, Select } from "@/components/ui/input";
import type { Expense, ExpenseCategory } from "@/types/finance";
import { todayIso } from "@/utils/dates";
import { getErrorMessage } from "@/utils/errors";
import { applyServerFieldErrors } from "@/utils/forms";
import { useCreateExpense, useCreateExpenseCategory, useUpdateExpense } from "./hooks";
import { expenseCategorySchema, expenseSchema, type ExpenseCategoryValues, type ExpenseValues } from "./schemas";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
  /** When set, the dialog edits this expense; otherwise it adds a new one. */
  expense?: Expense | null;
}

export function ExpenseDialog({ open, onOpenChange, categories, expense }: ExpenseDialogProps) {
  const editing = Boolean(expense);
  const [formError, setFormError] = useState<string | null>(null);
  const blank: ExpenseValues = { category_id: "", description: "", amount: "", expense_date: todayIso() };
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ExpenseValues>({ resolver: zodResolver(expenseSchema), defaultValues: blank });

  useEffect(() => {
    if (open) {
      reset(
        expense
          ? { category_id: expense.category_id, description: expense.description, amount: expense.amount, expense_date: expense.expense_date }
          : { category_id: "", description: "", amount: "", expense_date: todayIso() },
      );
      setFormError(null);
    }
  }, [open, expense, reset]);

  const close = () => onOpenChange(false);
  const create = useCreateExpense(close);
  const update = useUpdateExpense(expense?.id ?? "", close);
  const mutation = editing ? update : create;

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const handlers = {
      onError: (e: Error) => {
        if (!applyServerFieldErrors(e, setError, ["category_id", "description", "amount", "expense_date"])) setFormError(getErrorMessage(e));
      },
    };
    if (editing) update.mutate(v, handlers);
    else create.mutate(v, handlers);
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit expense" : "Add expense"}
      submitLabel={editing ? "Save changes" : "Add expense"}
      submitting={mutation.isPending}
      onSubmit={onSubmit}
      error={formError}
    >
      <FormField label="Category" htmlFor="x-category" error={errors.category_id?.message}>
        <Select id="x-category" aria-invalid={!!errors.category_id} {...register("category_id")}>
          <option value="">Choose…</option>
          {categories
            .filter((c) => c.status === "active" || c.id === expense?.category_id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
      </FormField>
      <FormField label="Description" htmlFor="x-desc" error={errors.description?.message}>
        <Input id="x-desc" aria-invalid={!!errors.description} {...register("description")} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount (₹)" htmlFor="x-amount" error={errors.amount?.message}>
          <Input id="x-amount" inputMode="decimal" aria-invalid={!!errors.amount} {...register("amount")} />
        </FormField>
        <FormField label="Date" htmlFor="x-date" error={errors.expense_date?.message}>
          <Input id="x-date" type="date" max={todayIso()} aria-invalid={!!errors.expense_date} {...register("expense_date")} />
        </FormField>
      </div>
    </FormDialog>
  );
}

/** Owner only. */
export function ExpenseCategoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ExpenseCategoryValues>({ resolver: zodResolver(expenseCategorySchema), defaultValues: { name: "", description: "" } });
  useEffect(() => {
    if (open) {
      reset();
      setFormError(null);
    }
  }, [open, reset]);
  const create = useCreateExpenseCategory(() => onOpenChange(false));

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    create.mutate(
      { name: v.name, description: v.description || null },
      {
        onError: (e) => {
          if (!applyServerFieldErrors(e, setError, ["name", "description"])) setFormError(getErrorMessage(e));
        },
      },
    );
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="New expense category" submitLabel="Add category" submitting={create.isPending} onSubmit={onSubmit} error={formError}>
      <FormField label="Name" htmlFor="xc-name" error={errors.name?.message}>
        <Input id="xc-name" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <FormField label="Description (optional)" htmlFor="xc-desc" error={errors.description?.message}>
        <Input id="xc-desc" {...register("description")} />
      </FormField>
    </FormDialog>
  );
}
