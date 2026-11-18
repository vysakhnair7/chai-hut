import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/common/FormField";
import { ActiveBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Category } from "@/types/catalog";
import { getErrorMessage } from "@/utils/errors";
import { useCreateCategory, useUpdateCategory } from "./hooks";
import { categorySchema, type CategoryValues } from "./schemas";

/** Owner only: add categories and switch them active/inactive. */
export function CategoriesDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryValues>({ resolver: zodResolver(categorySchema), defaultValues: { name: "", description: "" } });
  const create = useCreateCategory(() => reset());

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    create.mutate(
      { name: v.name, description: v.description || null },
      { onError: (e) => setFormError(getErrorMessage(e)) },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>Group menu items. Deactivate a category to retire it without deleting history.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-md border">
          {categories.length === 0 && <li className="p-3 text-sm text-muted-foreground">No categories yet.</li>}
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <FormField label="New category name" htmlFor="cat-name" error={errors.name?.message}>
            <Input id="cat-name" aria-invalid={!!errors.name} {...register("name")} />
          </FormField>
          <FormField label="Description (optional)" htmlFor="cat-desc" error={errors.description?.message}>
            <Input id="cat-desc" {...register("description")} />
          </FormField>
          {formError && (
            <p role="alert" className="text-sm font-medium text-danger">
              {formError}
            </p>
          )}
          <Button type="submit" loading={create.isPending}>
            Add category
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const update = useUpdateCategory(category.id);
  const next = category.status === "active" ? "inactive" : "active";
  return (
    <li className="flex items-center justify-between gap-2 p-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{category.name}</p>
        {category.description && <p className="truncate text-xs text-muted-foreground">{category.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ActiveBadge status={category.status} />
        <Button
          size="sm"
          variant="outline"
          loading={update.isPending}
          onClick={() => update.mutate({ status: next }, { onError: (e) => toast.error(getErrorMessage(e)) })}
        >
          {next === "inactive" ? "Deactivate" : "Activate"}
        </Button>
      </div>
    </li>
  );
}
