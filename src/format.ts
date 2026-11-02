const DASH = '–';

export function formatNumber(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || Number.isNaN(value) ? DASH : value.toFixed(digits);
}

export const formatTemperature = (value: number): string => `${formatNumber(value, 1)} °C`;
export const formatKw = (watts: number): string => `${formatNumber(watts / 1000, 1)} kW`;

export function formatSigned(value: number | null, digits: number, unit: string): string {
  if (value === null || Number.isNaN(value)) return DASH;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(digits)} ${unit}`;
}

export function formatWindow(hours: number): string {
  return hours < 48 ? `${hours} h` : `${hours / 24} d`;
}
