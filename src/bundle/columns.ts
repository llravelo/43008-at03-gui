// Table contract. Must stay in sync with tools/cadence_bundle.py (TRACE_DTYPES, decision_dtypes).

export const TRACE_NUMBER_COLUMNS = [
  'step', 'decision_idx', 'day_of_year', 'month', 'day_of_month', 'hour', 'minute', 'day_of_week', 'holiday_index',
  'outdoor_temperature', 'outdoor_humidity', 'wind_speed', 'wind_direction',
  'diffuse_solar_radiation', 'direct_solar_radiation',
  'heating_setpoint', 'cooling_setpoint', 'air_temperature', 'air_humidity',
  'occupancy', 'co2_emission', 'hvac_power', 'hvac_energy', 'reward', 'action',
  'comfort_low', 'comfort_up', 'violation', 'hours_until_open', 'energy_term', 'comfort_term', 'energy_kWh',
] as const;

export const TRACE_BOOLEAN_COLUMNS = ['workday', 'operating'] as const;

export const TRACE_COLUMNS = [...TRACE_NUMBER_COLUMNS, ...TRACE_BOOLEAN_COLUMNS] as const;

export type TraceNumberColumn = (typeof TRACE_NUMBER_COLUMNS)[number];
export type TraceBooleanColumn = (typeof TRACE_BOOLEAN_COLUMNS)[number];

/** One 15-minute simulation step. Optional extra columns (e.g. perimeter zone temperatures) live in `extra`. */
export type TraceRow = Record<TraceNumberColumn, number> &
  Record<TraceBooleanColumn, boolean> & { extra: Record<string, number> };

export const DECISION_BASE_COLUMNS = ['decision_idx', 'action', 'value'] as const;

export const scoreColumn = (actionId: number): string => `score_${actionId}`;

/** Columns the dashboard reads; the bundle's `f_<feature>` observation columns are not used. */
export function decisionColumns(actionCount: number): string[] {
  return [...DECISION_BASE_COLUMNS, ...Array.from({ length: actionCount }, (_, id) => scoreColumn(id))];
}

/** One hourly decision and, for agents, its per-action scores. */
export interface DecisionRow {
  decisionIdx: number;
  action: number;
  /** Q-values (DQN) or probabilities (PPO); null for policies without scores. */
  scores: number[] | null;
  /** PPO state value; null otherwise. */
  value: number | null;
}
