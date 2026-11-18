import { env } from "@/lib/env";
import type { ApiErrorBody } from "@/types/common";
import { ApiError } from "@/utils/errors";
import { notifyUnauthorized, session } from "./session";

type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

interface RequestOptions {
  query?: object;
  body?: unknown;
  headers?: Record<string, string>;
  /** false for the public endpoints (login, order tracking) */
  auth?: boolean;
  signal?: AbortSignal;
}

/** Drop undefined/null/empty values so filters that are not set never reach the URL. */
export function buildQuery(params?: object): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as QueryParams)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

async function parseError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    /* non-JSON error body */
  }
  const err = body?.error;
  return new ApiError(
    response.status,
    err?.code ?? "http_error",
    err?.message ?? `Request failed (${response.status})`,
    err?.details,
  );
}

/** The single place in the app that calls fetch. */
async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { query, body, headers = {}, auth = true, signal } = options;

  const finalHeaders: Record<string, string> = { Accept: "application/json", ...headers };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (auth) {
    const token = session.getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.apiTimeoutMs);
  signal?.addEventListener("abort", () => controller.abort());

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}${buildQuery(query)}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    const timedOut = controller.signal.aborted;
    throw new ApiError(
      0,
      timedOut ? "timeout" : "network_error",
      timedOut
        ? "The server took too long to respond. Please try again."
        : "Cannot reach the Chai Hut server. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const error = await parseError(response);
    // An expired or invalid token on an authenticated call ends the session everywhere.
    if (response.status === 401 && auth) notifyUnauthorized();
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body">) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...options, body: body ?? {} }),
  put: <T>(path: string, body: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, "body">) =>
    request<T>("DELETE", path, options),
};
