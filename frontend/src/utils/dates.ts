import { env } from "@/lib/env";
import type { IsoDate } from "@/types/common";

export type RangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "prevMonth"
  | "custom";

export interface ResolvedRange {
  date_from: IsoDate;
  date_to: IsoDate;
}

const pad = (n: number) => String(n).padStart(2, "0");

function toIso(d: Date): IsoDate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function fromIso(iso: IsoDate): Date {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Today's calendar date in the business timezone (matches the backend's business day). */
export function todayIso(now: Date = new Date(), timeZone: string = env.businessTimezone): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = fromIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function resolvePreset(preset: Exclude<RangePreset, "custom">, today: IsoDate): ResolvedRange {
  const t = fromIso(today);
  switch (preset) {
    case "today":
      return { date_from: today, date_to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { date_from: y, date_to: y };
    }
    case "last7":
      return { date_from: addDays(today, -6), date_to: today };
    case "last30":
      return { date_from: addDays(today, -29), date_to: today };
    case "thisMonth":
      return { date_from: toIso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))), date_to: today };
    case "prevMonth": {
      const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
      return { date_from: toIso(first), date_to: toIso(last) };
    }
  }
}

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  thisMonth: "This month",
  prevMonth: "Previous month",
  custom: "Custom range",
};
