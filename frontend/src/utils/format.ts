import { env } from "@/lib/env";
import type { IsoDate, IsoDateTime, Money } from "@/types/common";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Display an API decimal string as rupees. Formatting only: no business arithmetic. */
export function formatMoney(value: Money | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? inr.format(n) : "—";
}

export function formatPercent(value: string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2).replace(/\.00$/, "")}%` : "—";
}

export function formatDateTime(value: IsoDateTime | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: env.businessTimezone,
  }).format(new Date(value));
}

export function formatTime(value: IsoDateTime | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: env.businessTimezone,
  }).format(new Date(value));
}

/** "2026-11-18" -> "18 Nov 2026" (no timezone shifting: it is a calendar date). */
export function formatDate(value: IsoDate | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Short form for chart axes: "18 Nov". */
export function formatDateShort(value: IsoDate): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Chart helper: convert an API decimal string to a number for plotting only. */
export function toChartNumber(value: Money | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
