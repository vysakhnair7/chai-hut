import type { ApiErrorBody } from "@/types/common";

/** Normalised error thrown by the API client. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: { field: string; message: string }[];

  constructor(status: number, code: string, message: string, details: ApiErrorBody["error"]["details"] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

/** A message that is safe to show to a user (never a stack trace). */
export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message;
    if (error.status >= 500) return "The server had a problem. Please try again in a moment.";
    return error.message || fallback;
  }
  return fallback;
}
