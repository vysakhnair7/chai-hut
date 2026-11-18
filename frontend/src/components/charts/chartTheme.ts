/** Chart colours come from the same CSS design tokens as the rest of the UI. */
export const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  success: "hsl(var(--success))",
  danger: "hsl(var(--danger))",
  muted: "hsl(var(--muted-foreground))",
  grid: "hsl(var(--border))",
} as const;
