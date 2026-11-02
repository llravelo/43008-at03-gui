import type { DecisionRow } from '../bundle/columns';

/** Hourly decisions of one policy, indexed by decision_idx. */
export class DecisionLog {
  constructor(private readonly rows: readonly DecisionRow[]) {}

  get length(): number {
    return this.rows.length;
  }

  at(decisionIdx: number): DecisionRow | undefined {
    return this.rows[decisionIdx];
  }
}
