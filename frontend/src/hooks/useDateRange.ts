import { useMemo, useState } from "react";
import { resolvePreset, todayIso, type RangePreset, type ResolvedRange } from "@/utils/dates";

export interface DateRangeState {
  preset: RangePreset;
  setPreset: (preset: RangePreset) => void;
  customFrom: string;
  customTo: string;
  setCustomFrom: (v: string) => void;
  setCustomTo: (v: string) => void;
  /** The effective range, or null while a custom range is incomplete/invalid. */
  range: ResolvedRange | null;
}

export function useDateRange(initial: RangePreset = "last7"): DateRangeState {
  const [preset, setPreset] = useState<RangePreset>(initial);
  const today = todayIso();
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);

  const range = useMemo<ResolvedRange | null>(() => {
    if (preset === "custom") {
      if (!customFrom || !customTo || customTo < customFrom) return null;
      return { date_from: customFrom, date_to: customTo };
    }
    return resolvePreset(preset, today);
  }, [preset, customFrom, customTo, today]);

  return { preset, setPreset, customFrom, customTo, setCustomFrom, setCustomTo, range };
}
