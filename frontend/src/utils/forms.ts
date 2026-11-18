import { ApiError } from "@/utils/errors";

/**
 * Show backend validation messages next to the right form fields.
 * Returns true when at least one field message was applied.
 */
export function applyServerFieldErrors(
  error: unknown,
  setError: (field: never, error: { message: string }) => void,
  knownFields: readonly string[],
): boolean {
  if (!(error instanceof ApiError) || error.details.length === 0) return false;
  let applied = false;
  for (const d of error.details) {
    const field = d.field.split(".").pop() ?? "";
    if (knownFields.includes(field)) {
      setError(field as never, { message: d.message });
      applied = true;
    }
  }
  return applied;
}
