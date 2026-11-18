import { describe, expect, it } from "vitest";
import { ApiError, getErrorMessage } from "./errors";
import { newIdempotencyKey } from "./ids";

describe("getErrorMessage", () => {
  it("shows the backend's message for client errors", () => {
    expect(getErrorMessage(new ApiError(409, "insufficient_stock", "Only 1 Masala Chai left"))).toBe("Only 1 Masala Chai left");
  });
  it("hides server error details from the user", () => {
    expect(getErrorMessage(new ApiError(500, "internal_error", "Traceback (most recent call last)"))).not.toContain("Traceback");
  });
  it("explains network failures", () => {
    const error = new ApiError(0, "network_error", "Cannot reach the Chai Hut server.");
    expect(error.isNetwork).toBe(true);
    expect(getErrorMessage(error)).toContain("Cannot reach");
  });
  it("falls back for unknown errors", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("Something went wrong. Please try again.");
  });
});

describe("newIdempotencyKey", () => {
  it("is unique and non-empty", () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(50);
    for (const k of keys) expect(k.length).toBeGreaterThanOrEqual(16);
  });
});
