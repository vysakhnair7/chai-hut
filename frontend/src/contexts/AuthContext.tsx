import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authService } from "@/services/authService";
import { session, setUnauthorizedHandler } from "@/services/session";
import type { User } from "@/types/auth";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  /** True when the user was signed out because the backend rejected their token. */
  sessionExpired: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(session.getToken() ? "loading" : "anonymous");
  const [sessionExpired, setSessionExpired] = useState(false);

  const clearSession = useCallback(() => {
    session.clear();
    setUser(null);
    setStatus("anonymous");
    queryClient.clear(); // never leave one user's data in the cache for the next
  }, [queryClient]);

  // Any 401 from an authenticated request ends the session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSessionExpired(true);
      clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Restore the session after a page reload. The role always comes from the backend, never from storage.
  useEffect(() => {
    if (!session.getToken()) return;
    let cancelled = false;
    authService
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(async (username: string, password: string) => {
    const token = await authService.login({ username, password });
    session.setToken(token.access_token);
    try {
      const me = await authService.me();
      setSessionExpired(false);
      setUser(me);
      setStatus("authenticated");
      return me;
    } catch (error) {
      session.clear();
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setSessionExpired(false);
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, status, sessionExpired, login, logout }),
    [user, status, sessionExpired, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** For screens that only render for a logged-in user. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser used while logged out");
  return user;
}
