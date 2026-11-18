import { Loader2 } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { canAccess, HOME_BY_ROLE } from "@/constants/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

/** Requires a logged-in user. UX only: the backend enforces the real permissions. */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner />;
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Requires the current role to have the page in its navigation table. */
export function RoleRoute() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccess(user.role, location.pathname)) {
    return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  }
  return <Outlet />;
}

/** "/" and anything unknown for a logged-in user go to their home page. */
export function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : "/login"} replace />;
}
