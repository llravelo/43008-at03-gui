import type { PeriodTotals, Trace } from './trace';

export interface PeriodTotalsByPeriod {
  today: PeriodTotals;
  yearToDate: PeriodTotals;
}

/**
 * Totals of a trace up to `step`. Totals of different policies at the same step are comparable because
 * evaluation weather is deterministic: the same step is the same moment and weather (callers check `isAlignedWith`).
 */
export function periodTotals(trace: Trace, step: number): PeriodTotalsByPeriod {
  return { today: trace.totals(trace.startOfDay(step), step), yearToDate: trace.totals(0, step) };
}
