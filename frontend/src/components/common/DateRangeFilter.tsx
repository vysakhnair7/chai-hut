import { Input, Select } from "@/components/ui/input";
import type { DateRangeState } from "@/hooks/useDateRange";
import { RANGE_PRESET_LABELS, type RangePreset } from "@/utils/dates";

const PRESETS = Object.keys(RANGE_PRESET_LABELS) as RangePreset[];

interface DateRangeFilterProps {
  state: DateRangeState;
  /** Presets to offer (defaults to all). */
  presets?: RangePreset[];
}

export function DateRangeFilter({ state, presets = PRESETS }: DateRangeFilterProps) {
  const { preset, setPreset, customFrom, customTo, setCustomFrom, setCustomTo, range } = state;
  const invalid = preset === "custom" && range === null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Date range"
        value={preset}
        onChange={(e) => setPreset(e.target.value as RangePreset)}
        className="w-44"
      >
        {presets.map((p) => (
          <option key={p} value={p}>
            {RANGE_PRESET_LABELS[p]}
          </option>
        ))}
      </Select>
      {preset === "custom" && (
        <>
          <Input
            type="date"
            aria-label="From date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="w-40"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => setCustomTo(e.target.value)}
            className="w-40"
          />
        </>
      )}
      {invalid && <span className="text-xs text-danger">Choose a valid start and end date</span>}
    </div>
  );
}
