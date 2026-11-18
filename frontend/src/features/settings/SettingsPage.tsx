import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField } from "@/components/common/FormField";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/constants/labels";
import { useCurrentUser } from "@/contexts/AuthContext";
import { useApiMutation } from "@/hooks/useApiMutation";
import { authService } from "@/services/authService";
import { getErrorMessage } from "@/utils/errors";
import { applyServerFieldErrors } from "@/utils/forms";
import { changePasswordSchema, type ChangePasswordValues } from "./schemas";

export default function SettingsPage() {
  const user = useCurrentUser();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  const change = useApiMutation(
    (v: ChangePasswordValues) => authService.changePassword({ current_password: v.current_password, new_password: v.new_password }),
    {
      toastError: false,
      onSuccess: () => {
        toast.success("Password changed");
        reset();
      },
    },
  );

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    change.mutate(v, {
      onError: (e) => {
        if (!applyServerFieldErrors(e, setError, ["current_password", "new_password"])) setFormError(getErrorMessage(e));
      },
    });
  });

  return (
    <>
      <PageHeader title="Settings" description="Your account." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[7rem_1fr] gap-y-3 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{user.full_name}</dd>
              <dt className="text-muted-foreground">Username</dt>
              <dd>{user.username}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd>{ROLE_LABELS[user.role]}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>At least 10 characters, with a letter and a digit.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <FormField label="Current password" htmlFor="cp-current" error={errors.current_password?.message}>
                <Input id="cp-current" type="password" autoComplete="current-password" aria-invalid={!!errors.current_password} {...register("current_password")} />
              </FormField>
              <FormField label="New password" htmlFor="cp-new" error={errors.new_password?.message}>
                <Input id="cp-new" type="password" autoComplete="new-password" aria-invalid={!!errors.new_password} {...register("new_password")} />
              </FormField>
              <FormField label="Repeat new password" htmlFor="cp-confirm" error={errors.confirm_password?.message}>
                <Input id="cp-confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm_password} {...register("confirm_password")} />
              </FormField>
              {formError && (
                <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                  {formError}
                </p>
              )}
              <Button type="submit" loading={change.isPending}>
                Change password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
