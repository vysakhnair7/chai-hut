import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, formatPercent, pluralize, toChartNumber } from "./format";

describe("formatMoney", () => {
  it("formats API decimal strings as rupees", () => {
    expect(formatMoney("1234.5")).toBe("₹1,234.50");
  });
  it("uses Indian digit grouping", () => {
    expect(formatMoney("100000")).toBe("₹1,00,000.00");
  });
  it("shows a dash, not zero, when a value is missing (e.g. unknown profit)", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney("")).toBe("—");
  });
  it("shows a dash for non-numeric input instead of NaN", () => {
    expect(formatMoney("abc")).toBe("—");
  });
});

describe("formatPercent", () => {
  it("trims a trailing .00", () => {
    expect(formatPercent("5.00")).toBe("5%");
    expect(formatPercent("12.5")).toBe("12.5%");
  });
  it("handles null", () => {
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats a calendar date without timezone shifting", () => {
    expect(formatDate("2026-11-18")).toBe("18 Nov 2026");
    expect(formatDate("2026-01-01")).toBe("01 Jan 2026");
  });
  it("returns a dash for empty input", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("helpers", () => {
  it("toChartNumber never returns NaN", () => {
    expect(toChartNumber("12.50")).toBe(12.5);
    expect(toChartNumber(null)).toBe(0);
    expect(toChartNumber("x")).toBe(0);
  });
  it("pluralize", () => {
    expect(pluralize(1, "order")).toBe("1 order");
    expect(pluralize(3, "order")).toBe("3 orders");
  });
});
