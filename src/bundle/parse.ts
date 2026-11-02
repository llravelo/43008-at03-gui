import {
  decisionColumns,
  scoreColumn,
  TRACE_BOOLEAN_COLUMNS,
  TRACE_COLUMNS,
  TRACE_NUMBER_COLUMNS,
  type DecisionRow,
  type TraceRow,
} from './columns';
import { BundleError } from './errors';
import { manifestSchema, type Manifest } from './manifest';
import type { Table } from './tableReader';

export function parseManifest(json: unknown, file: string): Manifest {
  const result = manifestSchema.safeParse(json);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new BundleError(`invalid manifest — ${problems.join('; ')}`, file);
  }
  return result.data;
}

export function requireColumns(table: Table, required: readonly string[], file: string): void {
  const available = new Set(table.columns);
  const missing = required.filter((column) => !available.has(column));
  if (missing.length > 0) throw new BundleError(`missing columns ${missing.join(', ')}`, file);
}

export function parseTrace(table: Table, file: string): TraceRow[] {
  requireColumns(table, TRACE_COLUMNS, file);
  const known = new Set<string>(TRACE_COLUMNS);
  const extraColumns = table.columns.filter((column) => !known.has(column));

  return table.rows.map((raw, index) => {
    const row = {} as TraceRow;
    for (const column of TRACE_NUMBER_COLUMNS) row[column] = toNumber(raw[column]);
    for (const column of TRACE_BOOLEAN_COLUMNS) row[column] = raw[column] === true;
    row.extra = Object.fromEntries(extraColumns.map((column) => [column, toNumber(raw[column])]));
    if (row.step !== index) throw new BundleError(`'step' must be 0..n-1 (row ${index} has ${row.step})`, file);
    return row;
  });
}

export function parseDecisions(table: Table, manifest: Manifest, file: string): DecisionRow[] {
  const actionCount = manifest.actions.length;
  requireColumns(table, decisionColumns(actionCount), file);

  return table.rows.map((raw) => {
    const scores = Array.from({ length: actionCount }, (_, id) => toNullableNumber(raw[scoreColumn(id)]));
    return {
      decisionIdx: toNumber(raw.decision_idx),
      action: toNumber(raw.action),
      scores: scores.every((score): score is number => score !== null) ? scores : null,
      value: toNullableNumber(raw.value),
    };
  });
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}
