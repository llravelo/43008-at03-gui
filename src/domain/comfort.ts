import type { TraceRow } from '../bundle/columns';

export type ComfortStatus = 'in_band' | 'below' | 'above';

export function comfortStatus(row: Pick<TraceRow, 'air_temperature' | 'comfort_low' | 'comfort_up'>): ComfortStatus {
  if (row.air_temperature < row.comfort_low) return 'below';
  if (row.air_temperature > row.comfort_up) return 'above';
  return 'in_band';
}
