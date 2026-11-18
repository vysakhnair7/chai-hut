/** All environment configuration is read here, once. */
const raw = import.meta.env;

export const env = {
  apiBaseUrl: String(raw.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, ""),
  businessTimezone: String(raw.VITE_BUSINESS_TIMEZONE ?? "Asia/Kolkata"),
  apiTimeoutMs: Number(raw.VITE_API_TIMEOUT_MS ?? 15000),
} as const;
