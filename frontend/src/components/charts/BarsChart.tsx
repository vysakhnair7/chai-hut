import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/utils/format";
import { CHART_COLORS } from "./chartTheme";

export interface BarDatum {
  label: string;
  value: number;
}

interface BarsChartProps {
  data: BarDatum[];
  seriesName: string;
  /** "money" formats tooltip values as rupees; "count" shows plain numbers. */
  unit?: "money" | "count";
  color?: keyof typeof CHART_COLORS;
  height?: number;
  /** Horizontal bars suit long labels such as product or company names. */
  horizontal?: boolean;
}

export function BarsChart({
  data,
  seriesName,
  unit = "money",
  color = "primary",
  height = 260,
  horizontal = false,
}: BarsChartProps) {
  const fmt = (v: unknown) => (unit === "money" ? formatMoney(String(v)) : String(v));
  return (
    <div style={{ height }} role="img" aria-label={`${seriesName} bar chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 12 }} stroke={CHART_COLORS.muted} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} stroke={CHART_COLORS.muted} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke={CHART_COLORS.muted} />
              <YAxis tick={{ fontSize: 12 }} stroke={CHART_COLORS.muted} width={60} />
            </>
          )}
          <Tooltip formatter={(v: unknown) => [fmt(v), seriesName]} />
          <Bar dataKey="value" fill={CHART_COLORS[color]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
