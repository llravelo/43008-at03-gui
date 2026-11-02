import type { TraceRow } from '../../bundle/columns';
import { comfortStatus, type ComfortStatus } from '../../domain/comfort';
import { formatKw, formatTemperature } from '../../format';

export type KpiTone = 'neutral' | 'good' | 'warning' | 'info';

/** One KPI card. Add descriptors to show more readings (e.g. optional perimeter zone temperatures). */
export interface KpiDescriptor {
  id: string;
  label: string;
  value: (row: TraceRow) => string;
  tone?: (row: TraceRow) => KpiTone;
}

const COMFORT_LABEL: Record<ComfortStatus, string> = {
  in_band: 'In band',
  below: 'Below band',
  above: 'Above band',
};

export const OPERATIONS_KPIS: readonly KpiDescriptor[] = [
  {
    id: 'zone-temperature',
    label: 'Zone temperature',
    value: (row) => formatTemperature(row.air_temperature),
  },
  {
    id: 'outdoor-temperature',
    label: 'Outdoor',
    value: (row) => formatTemperature(row.outdoor_temperature),
  },
  {
    id: 'hvac-demand',
    label: 'HVAC demand',
    value: (row) => formatKw(row.hvac_power),
  },
  {
    id: 'operating-hours',
    label: 'Operating hours',
    value: (row) => (row.operating ? 'Operating' : 'Off-hours'),
    tone: (row) => (row.operating ? 'info' : 'neutral'),
  },
  {
    id: 'comfort',
    label: 'Comfort status',
    value: (row) => COMFORT_LABEL[comfortStatus(row)],
    tone: (row) => {
      if (comfortStatus(row) === 'in_band') return 'good';
      return row.operating ? 'warning' : 'neutral';
    },
  },
];
