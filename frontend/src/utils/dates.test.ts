import { describe, expect, it } from "vitest";
import { addDays, resolvePreset, todayIso } from "./dates";

describe("todayIso", () => {
  it("uses the business timezone, not the browser's", () => {
    // 20:00 UTC on the 17th is already 01:30 on the 18th in India.
    const instant = new Date("2026-11-17T20:00:00Z");
    expect(todayIso(instant, "Asia/Kolkata")).toBe("2026-11-18");
    expect(todayIso(instant, "UTC")).toBe("2026-11-17");
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("resolvePreset", () => {
  const today = "2026-11-18";
  it("today / yesterday", () => {
    expect(resolvePreset("today", today)).toEqual({ date_from: today, date_to: today });
    expect(resolvePreset("yesterday", today)).toEqual({ date_from: "2026-11-17", date_to: "2026-11-17" });
  });
  it("last 7 days includes today (7 calendar days)", () => {
    expect(resolvePreset("last7", today)).toEqual({ date_from: "2026-11-12", date_to: today });
  });
  it("this month starts on the 1st", () => {
    expect(resolvePreset("thisMonth", today)).toEqual({ date_from: "2026-11-01", date_to: today });
  });
  it("previous month covers the whole month", () => {
    expect(resolvePreset("prevMonth", today)).toEqual({ date_from: "2026-10-01", date_to: "2026-10-31" });
    expect(resolvePreset("prevMonth", "2026-01-15")).toEqual({ date_from: "2025-12-01", date_to: "2025-12-31" });
  });
});
