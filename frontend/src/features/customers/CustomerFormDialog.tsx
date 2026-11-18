import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FormDialog } from "@/components/common/FormDialog";
import { FormField } from "@/components/common/FormField";
import { Input, Select } from "@/components/ui/input";
import type { Customer } from "@/types/customer";
import { applyServerFieldErrors } from "@/utils/forms";
import { getErrorMessage } from "@/utils/errors";
import { useCreateCustomer, useUpdateCustomer } from "./hooks";
import {
  customerCreateSchema,
  customerEditSchema,
  type CustomerCreateValues,
  type CustomerEditValues,
} from "./schemas";

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Register a new corporate customer. The backend issues the Chai ID. */
export function CustomerCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: BaseProps & { onCreated?: (customer: Customer) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CustomerCreateValues>({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: { username: "", full_name: "", company_name: "", phone: "" },
  });

  useEffect(() => {
    if (open) {
      reset();
      setFormError(null);
    }
  }, [open, reset]);

  const create = useCreateCustomer((customer) => {
    onOpenChange(false);
    onCreated?.(customer);
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    create.mutate(values, {
      onError: (error) => {
        const applied = applyServerFieldErrors(error, setError, ["username", "full_name", "company_name", "phone"]);
        if (!applied) setFormError(getErrorMessage(error));
      },
    });
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Register customer"
      description="A unique Chai ID is generated automatically."
      submitLabel="Register"
      submitting={create.isPending}
      onSubmit={onSubmit}
      error={formError}
    >
      <FormField label="Full name" htmlFor="c-full_name" error={errors.full_name?.message}>
        <Input id="c-full_name" autoComplete="off" aria-invalid={!!errors.full_name} {...register("full_name")} />
      </FormField>
      <FormField label="Company" htmlFor="c-company_name" error={errors.company_name?.message}>
        <Input id="c-company_name" autoComplete="off" aria-invalid={!!errors.company_name} {...register("company_name")} />
      </FormField>
      <FormField label="Phone" htmlFor="c-phone" error={errors.phone?.message} hint="7–15 digits, may start with +">
        <Input id="c-phone" type="tel" autoComplete="off" aria-invalid={!!errors.phone} {...register("phone")} />
      </FormField>
      <FormField
        label="Username"
        htmlFor="c-username"
        error={errors.username?.message}
        hint="Lowercase letters, digits, '.', '_' or '-'"
      >
        <Input id="c-username" autoComplete="off" aria-invalid={!!errors.username} {...register("username")} />
      </FormField>
    </FormDialog>
  );
}

/** Edit profile fields and active/inactive status (the Chai ID is never edited by hand). */
export function CustomerEditDialog({ open, onOpenChange, customer }: BaseProps & { customer: Customer }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CustomerEditValues>({
    resolver: zodResolver(customerEditSchema),
    defaultValues: {
      full_name: customer.full_name,
      company_name: customer.company_name,
      phone: customer.phone,
      status: customer.status,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        full_name: customer.full_name,
        company_name: customer.company_name,
        phone: customer.phone,
        status: customer.status,
      });
      setFormError(null);
    }
  }, [open, customer, reset]);

  const update = useUpdateCustomer(customer.id, () => onOpenChange(false));

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    update.mutate(values, {
      onError: (error) => {
        const applied = applyServerFieldErrors(error, setError, ["full_name", "company_name", "phone", "status"]);
        if (!applied) setFormError(getErrorMessage(error));
      },
    });
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit customer"
      submitLabel="Save changes"
      submitting={update.isPending}
      onSubmit={onSubmit}
      error={formError}
    >
      <FormField label="Full name" htmlFor="e-full_name" error={errors.full_name?.message}>
        <Input id="e-full_name" aria-invalid={!!errors.full_name} {...register("full_name")} />
      </FormField>
      <FormField label="Company" htmlFor="e-company_name" error={errors.company_name?.message}>
        <Input id="e-company_name" aria-invalid={!!errors.company_name} {...register("company_name")} />
      </FormField>
      <FormField label="Phone" htmlFor="e-phone" error={errors.phone?.message}>
        <Input id="e-phone" type="tel" aria-invalid={!!errors.phone} {...register("phone")} />
      </FormField>
      <FormField label="Status" htmlFor="e-status" error={errors.status?.message}>
        <Select id="e-status" {...register("status")}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </FormField>
    </FormDialog>
  );
}
