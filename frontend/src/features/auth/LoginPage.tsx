import { zodResolver } from "@hookform/resolvers/zod";
import { Coffee, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HOME_BY_ROLE } from "@/constants/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { loginSchema, type LoginFormValues } from "./schemas";

export default function LoginPage() {
  const { user, status, login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    document.title = "Sign in · Chai Hut";
  }, []);

  if (status === "authenticated" && user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    try {
      const me = await login(values.username, values.password);
      navigate(HOME_BY_ROLE[me.role], { replace: true }); // OWNER/MANAGER -> dashboard, CASHIER -> POS
    } catch (error) {
      setFormError(getErrorMessage(error, "Could not sign in. Please try again."));
    }
  };

  const expired = sessionExpired || params.get("expired") === "1";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Coffee className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold">Chai Hut</h1>
          <p className="text-sm text-muted-foreground">Staff sign in</p>
        </div>

        {expired && !formError && (
          <p role="status" className="mb-4 rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
            Your session expired. Please sign in again.
          </p>
        )}
        {formError && (
          <p role="alert" className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            {formError}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label="Username" htmlFor="username" error={errors.username?.message}>
            <Input id="username" autoComplete="username" autoFocus aria-invalid={!!errors.username} {...register("username")} />
          </FormField>
          <FormField label="Password" htmlFor="password" error={errors.password?.message}>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                className="pr-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Sign in
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Customers don't need an account. Ask the café team to look you up.
        </p>
      </Card>
    </div>
  );
}
