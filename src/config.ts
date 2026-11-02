export const APP_CONFIG = {
  bundlesBaseUrl: `${import.meta.env.BASE_URL}bundles`,
  /** Policies in the energy-savings and comfort-violation panels, in column order before the controller. */
  comparisonPolicies: ['fixed_setpoint', 'random', 'rule_based'],
  /** Policy those panels measure savings and violation differences against. */
  baselinePolicy: 'fixed_setpoint',
  /** Policies offered as dashed overlays in the building-data charts, in checkbox order. */
  overlayPolicies: ['fixed_setpoint', 'random', 'rule_based'],
  /** Overlays shown when the dashboard opens. */
  initialOverlays: ['rule_based'],
  /** Day 15, 07:00: a winter workday morning, one hour before the building opens. */
  initialCursor: 14 * 24 + 7,
  playbackIntervalMs: 800,
  playbackSpeedsHours: [1, 6, 24],
  chartWindowsHours: [24, 7 * 24, 30 * 24],
  eventLogLength: 12,
} as const;
