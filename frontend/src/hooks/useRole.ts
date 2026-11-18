import { useCurrentUser } from "@/contexts/AuthContext";

/**
 * Role flags for UX only (hiding buttons, choosing a layout).
 * The backend independently enforces every permission, so a hidden button is never the only protection.
 */
export function useRole() {
  const { role } = useCurrentUser();
  return {
    role,
    isOwner: role === "owner",
    /** Owner or manager: sees financial data, payments, dues, expenses. */
    isManagerUp: role === "owner" || role === "manager",
    isCashier: role === "cashier",
  };
}
