import type { TraceRow } from '../bundle/columns';
import { stepTimestamp } from './calendar';

export interface TraceTiming {
  nominalYear: number;
  timestepsPerHour: number;
  actionRepeat: number;
}

export interface PeriodTotals {
  energyKWh: number;
  /** Hours with the zone outside the comfort band during operating hours. */
  violationHours: number;
}

/** One simulated year of 15-minute steps (row index == step), with O(1) range totals. */
export class Trace {
  readonly timestamps: Float64Array;
  private readonly energyPrefix: Float64Array;
  private readonly violationPrefix: Float64Array;

  constructor(
    readonly rows: readonly TraceRow[],
    readonly timing: TraceTiming,
  ) {
    this.timestamps = Float64Array.from(rows, (row) => stepTimestamp(row, timing.nominalYear));
    this.energyPrefix = prefixSum(rows, (row) => row.energy_kWh);
    this.violationPrefix = prefixSum(rows, (row) => (row.operating && row.violation > 0 ? 1 : 0));
  }

  get length(): number {
    return this.rows.length;
  }

  get decisionCount(): number {
    return Math.floor(this.rows.length / this.timing.actionRepeat);
  }

  row(step: number): TraceRow {
    const row = this.rows[step];
    if (row === undefined) throw new RangeError(`Step ${step} is outside the trace (0..${this.length - 1})`);
    return row;
  }

  /** First simulation step governed by a decision; the dashboard's "now" for that decision. */
  stepOfDecision(decisionIdx: number): number {
    return decisionIdx * this.timing.actionRepeat;
  }

  /** Rows of the `hours` ending at `endStep` (inclusive). */
  window(endStep: number, hours: number): readonly TraceRow[] {
    const span = hours * this.timing.timestepsPerHour;
    return this.rows.slice(Math.max(0, endStep - span + 1), endStep + 1);
  }

  startOfDay(step: number): number {
    const row = this.row(step);
    const minutesPerStep = 60 / this.timing.timestepsPerHour;
    return step - row.hour * this.timing.timestepsPerHour - row.minute / minutesPerStep;
  }

  /** Totals over steps `from`..`to` (inclusive). */
  totals(from: number, to: number): PeriodTotals {
    const steps = this.timing.timestepsPerHour;
    return {
      energyKWh: rangeSum(this.energyPrefix, from, to),
      violationHours: rangeSum(this.violationPrefix, from, to) / steps,
    };
  }

  /** True when both traces describe the same timestamps (same climate, same evaluation calendar). */
  isAlignedWith(other: Trace): boolean {
    return this.length === other.length && this.timestamps.every((timestamp, i) => timestamp === other.timestamps[i]);
  }
}

function prefixSum(rows: readonly TraceRow[], value: (row: TraceRow) => number): Float64Array {
  const prefix = new Float64Array(rows.length + 1);
  rows.forEach((row, i) => {
    prefix[i + 1] = (prefix[i] ?? 0) + value(row);
  });
  return prefix;
}

function rangeSum(prefix: Float64Array, from: number, to: number): number {
  return (prefix[to + 1] ?? 0) - (prefix[from] ?? 0);
}
