/**
 * Access-token storage. The backend issues a short-lived (60 min) bearer token in the response body
 * (no cookies, no refresh token), so it is kept in sessionStorage: cleared when the tab closes and
 * never written to localStorage.
 */
const KEY = "chai-hut.access-token";

export const session = {
  getToken(): string | null {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string): void {
    try {
      sessionStorage.setItem(KEY, token);
    } catch {
      /* storage unavailable: the user will simply have to log in again after a reload */
    }
  },
  clear(): void {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** AuthProvider registers this so any 401 signs the user out in one place. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

export function notifyUnauthorized(): void {
  onUnauthorized?.();
}
