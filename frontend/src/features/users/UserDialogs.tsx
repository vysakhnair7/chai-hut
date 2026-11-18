import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FormDialog } from "@/components/common/FormDialog";
import { FormField } from "@/components/common/FormField";
import { Input, Select } from "@/components/ui/input";
import { ROLE_LABELS } from "@/constants/labels";
import type { Role, User } from "@/types/auth";
import { getErrorMessage } from "@/utils/errors";
import { applyServerFieldErrors } from "@/utils/forms";
import { useCreateUser, useResetPassword, useUpdateUser } from "./hooks";
import {
  resetPasswordSchema,
  userCreateSchema,
  userEditSchema,
  type ResetPasswordValues,
  type UserCreateValues,
  type UserEditValues,
} from "./schemas";

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLES: Role[] = ["owner", "manager", "cashier"];

function RoleOptions() {
  return (
    <>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </>
  );
}

export function UserCreateDialog({ open, onOpenChange }: BaseProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<UserCreateValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { username: "", full_name: "", role: "cashier", password: "" },
  });
  useEffect(() => {
    if (open) {
      reset();
      setFormError(null);
    }
  }, [open, reset]);
  const create = useCreateUser(() => onOpenChange(false));

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    create.mutate(v, {
      onError: (e) => {
        if (!applyServerFieldErrors(e, setError, ["username", "full_name", "role", "password"])) setFormError(getErrorMessage(e));
      },
    });
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add employee"
      description="Choose a temporary password and share it privately. They can change it in Settings."
      submitLabel="Create employee"
      submitting={create.isPending}
      onSubmit={onSubmit}
      error={formError}
    >
      <FormField label="Full name" htmlFor="u-name" error={errors.full_name?.message}>
        <Input id="u-name" autoComplete="off" aria-invalid={!!errors.full_name} {...register("full_name")} />
      </FormField>
      <FormField label="Username" htmlFor="u-username" error={errors.username?.message} hint="Lowercase letters, digits, '.', '_' or '-'">
        <Input id="u-username" autoComplete="off" aria-invalid={!!errors.username} {...register("username")} />
      </FormField>
      <FormField label="Role" htmlFor="u-role" error={errors.role?.message}>
        <Select id="u-role" {...register("role")}>
          <RoleOptions />
        </Select>
      </FormField>
      <FormField label="Temporary password" htmlFor="u-password" error={errors.password?.message} hint="At least 10 characters with a letter and a digit">
        <Input id="u-password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
      </FormField>
    </FormDialog>
  );
}

export function UserEditDialog({ open, onOpenChange, user, isSelf }: BaseProps & { user: User; isSelf: boolean }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<UserEditValues>({
    resolver: zodResolver(userEditSchema),
    defaultValues: { full_name: user.full_name, role: user.role, status: user.status },
  });
  useEffect(() => {
    if (open) {
      reset({ full_name: user.full_name, role: user.role, status: user.status });
      setFormError(null);
    }
  }, [open, user, reset]);
  const update = useUpdateUser(user.id, () => onOpenChange(false));

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    update.mutate(v, {
      onError: (e) => {
        if (!applyServerFieldErrors(e, setError, ["full_name", "role", "status"])) setFormError(getErrorMessage(e));
      },
    });
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${user.username}`}
      description={isSelf ? "This is your own account: role and status changes may be refused." : undefined}
      submitLabel="Save changes"
      submitting={update.isPending}
      onSubmit={onSubmit}
      error={formError}
    >
      <FormField label="Full name" htmlFor="ue-name" error={errors.full_name?.message}>
        <Input id="ue-name" aria-invalid={!!errors.full_name} {...register("full_name")} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Role" htmlFor="ue-role" error={errors.role?.message}>
          <Select id="ue-role" {...register("role")}>
            <RoleOptions />
          </Select>
        </FormField>
        <FormField label="Status" htmlFor="ue-status" error={errors.status?.message}>
          <Select id="ue-status" {...register("status")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </FormField>
      </div>
    </FormDialog>
  );
}

export function ResetPasswordDialog({ open, onOpenChange, user }: BaseProps & { user: User }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { new_password: "" } });
  useEffect(() => {
    if (open) {
      reset();
      setFormError(null);
    }
  }, [open, reset]);
  const resetPw = useResetPassword(user.id, () => onOpenChange(false));

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    resetPw.mutate(v.new_password, {
      onError: (e) => {
        if (!applyServerFieldErrors(e, setError, ["new_password"])) setFormError(getErrorMessage(e));
      },
    });
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Reset password for ${user.username}`}
      description="Set a new temporary password and share it privately."
      submitLabel="Reset password"
      submitting={resetPw.isPending}
      onSubmit={onSubmit}
      error={formError}
    >
      <FormField label="New password" htmlFor="rp-password" error={errors.new_password?.message} hint="At least 10 characters with a letter and a digit">
        <Input id="rp-password" type="password" autoComplete="new-password" aria-invalid={!!errors.new_password} {...register("new_password")} />
      </FormField>
    </FormDialog>
  );
}
