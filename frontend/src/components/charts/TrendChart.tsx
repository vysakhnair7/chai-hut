import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/utils/format";
import { CHART_COLORS } from "./chartTheme";

export interface TrendDatum {
  label: string;
  value: number;
}

interface TrendChartProps {
  data: TrendDatum[];
  /** Used in the tooltip, e.g. "Net sales". */
  seriesName: string;
  height?: number;
}

export function TrendChart({ data, seriesName, height = 260 }: TrendChartProps) {
  return (
    <div style={{ height }} role="img" aria-label={`${seriesName} trend chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke={CHART_COLORS.muted} />
          <YAxis tick={{ fontSize: 12 }} stroke={CHART_COLORS.muted} width={60} />
          <Tooltip formatter={(v: unknown) => [formatMoney(String(v)), seriesName]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={data.length <= 31}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
