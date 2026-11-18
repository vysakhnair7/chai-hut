import { describe, expect, it } from "vitest";
import { optionalPositiveMoney, passwordField, phoneField, positiveMoney, usernameField } from "./schemas";

describe("phoneField", () => {
  it("normalises spaces and dashes like the backend", () => {
    expect(phoneField.parse("+91 98765-43210")).toBe("+919876543210");
  });
  it("rejects short or lettered numbers", () => {
    expect(phoneField.safeParse("12345").success).toBe(false);
    expect(phoneField.safeParse("98765abc10").success).toBe(false);
  });
});

describe("usernameField", () => {
  it("lowercases and trims", () => {
    expect(usernameField.parse("  Ana.K ")).toBe("ana.k");
  });
  it("rejects spaces and too-short names", () => {
    expect(usernameField.safeParse("a b").success).toBe(false);
    expect(usernameField.safeParse("ab").success).toBe(false);
  });
});

describe("passwordField", () => {
  it("needs 10+ characters with a letter and a digit", () => {
    expect(passwordField.safeParse("short1").success).toBe(false);
    expect(passwordField.safeParse("onlyletterslong").success).toBe(false);
    expect(passwordField.safeParse("1234567890123").success).toBe(false);
    expect(passwordField.safeParse("a-good-pass-123").success).toBe(true);
  });
});

describe("positiveMoney", () => {
  it("accepts up to two decimals", () => {
    expect(positiveMoney.safeParse("120").success).toBe(true);
    expect(positiveMoney.safeParse("120.50").success).toBe(true);
  });
  it("rejects zero, negatives and three decimals", () => {
    expect(positiveMoney.safeParse("0").success).toBe(false);
    expect(positiveMoney.safeParse("-5").success).toBe(false);
    expect(positiveMoney.safeParse("1.234").success).toBe(false);
  });
});

describe("optionalPositiveMoney", () => {
  it("allows blank (meaning: let the backend use the full balance)", () => {
    expect(optionalPositiveMoney.safeParse("").success).toBe(true);
    expect(optionalPositiveMoney.safeParse("  ").success).toBe(true);
  });
  it("gives a readable message for zero, not a technical union error", () => {
    const result = optionalPositiveMoney.safeParse("0");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("Amount must be greater than zero");
  });
  it("rejects text", () => {
    const result = optionalPositiveMoney.safeParse("abc");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("Enter an amount like 120 or 120.50");
  });
});
