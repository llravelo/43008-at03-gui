import type { TraceRow } from '../../bundle/columns';
import { formatClock } from '../../domain/calendar';
import { contiguousRuns } from '../../domain/runs';
import type { Trace } from '../../domain/trace';
import type { ChartOption } from '../echarts';
import { axisStyle, baseOption, legendStyle, tooltipStyle, type ChartPalette } from '../theme';

/** Another policy's run on the same weather, drawn dashed in its policy colour. */
export interface OverlaySeries {
  key: string;
  name: string;
  color: string;
  trace: Trace;
}

export interface BuildingChartInput {
  trace: Trace;
  endStep: number;
  hours: number;
  /** Legend name of the selected controller's solid lines. */
  controllerName: string;
  /** Policies drawn dashed for comparison (only the ones the user enabled). */
  overlays: readonly OverlaySeries[];
  showSetpoints: boolean;
  palette: ChartPalette;
}

/** Identical horizontal margins keep the stacked charts' time axes aligned; the left one fits the axis title. */
const GRID = { left: 60, right: 20, top: 36, bottom: 28 } as const;
const COMFORT_STACK = 'comfort';
const SETPOINT_NAMES = ['Heating setpoint', 'Cooling setpoint'] as const;
/** Space after "now" (fraction of the window) so the marker doesn't sit on the chart edge. */
const NOW_PADDING_FRACTION = 0.02;

interface ChartWindow {
  rows: readonly TraceRow[];
  /** Rows of each overlay, index-aligned with `rows`. */
  overlayRows: readonly (readonly TraceRow[])[];
  timeOf: (index: number) => number;
  /** Timestamp of the dashboard's current time: the last row of the window. */
  now: number;
  points: (source: readonly TraceRow[], value: (row: TraceRow) => number) => number[][];
  operatingAreas: { xAxis: number }[][];
}

function chartWindow({ trace, endStep, hours, overlays }: BuildingChartInput): ChartWindow {
  const rows = trace.window(endStep, hours);
  const firstStep = endStep - rows.length + 1;
  const timeOf = (index: number): number => trace.timestamps[firstStep + index] ?? 0;
  return {
    rows,
    overlayRows: overlays.map((overlay) => overlay.trace.window(endStep, hours)),
    timeOf,
    now: timeOf(rows.length - 1),
    points: (source, value) => source.map((row, index) => [timeOf(index), value(row)]),
    operatingAreas: contiguousRuns(rows, (row) => (row.operating ? true : null)).map((run) => [
      { xAxis: timeOf(run.start) },
      { xAxis: timeOf(run.end) },
    ]),
  };
}

/**
 * Layout shared by the three stacked charts: same grid, time axis and operating-hours tooltip header.
 * The y-axis title names the quantity; the legend only distinguishes policies and setpoints.
 */
function stackedChart(
  window: ChartWindow,
  palette: ChartPalette,
  axisTitle: string,
  legend: readonly string[],
  describe: (row: TraceRow, index: number) => string[],
) {
  return {
    ...baseOption(palette),
    grid: GRID,
    legend: legendStyle(palette, { show: legend.length > 0, data: legend }),
    tooltip: tooltipStyle(palette, {
      trigger: 'axis',
      formatter: (params: { dataIndex: number }[]) => {
        const index = params[0]?.dataIndex ?? 0;
        const row = window.rows[index];
        if (row === undefined) return '';
        const header = `<b>${formatClock(window.timeOf(index))}</b>${row.operating ? ' · operating' : ''}`;
        return [header, ...describe(row, index)].join('<br/>');
      },
    }),
    xAxis: {
      type: 'time',
      min: window.timeOf(0),
      max: window.now + (window.now - window.timeOf(0)) * NOW_PADDING_FRACTION,
      ...axisStyle(palette),
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: axisTitle,
      nameLocation: 'middle',
      nameGap: 36,
      scale: true,
      ...axisStyle(palette),
    },
  };
}

function operatingShade(window: ChartWindow, palette: ChartPalette) {
  return { silent: true, itemStyle: { color: palette.operatingShade }, data: window.operatingAreas, z: 0 };
}

/** Vertical line at the current time, shared by all stacked charts. */
function nowMarker(window: ChartWindow, palette: ChartPalette) {
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: palette.text, type: 'solid', width: 1.5 },
    label: { formatter: 'Now', position: 'end', color: palette.text, fontSize: 11 },
    data: [{ xAxis: window.now }],
  };
}

/** Core zone temperature against the comfort band, optionally with the setpoints. */
export function temperatureChartOption(input: BuildingChartInput): ChartOption {
  const { palette, overlays, controllerName, showSetpoints } = input;
  const window = chartWindow(input);
  const { rows, points } = window;
  const legend = [controllerName, ...(showSetpoints ? SETPOINT_NAMES : []), ...overlays.map(policyName)];

  return {
    ...stackedChart(window, palette, 'Zone temp. (°C)', legend, (row, index) => {
      const lines = [
        `Zone ${row.air_temperature.toFixed(1)} °C (band ${row.comfort_low}–${row.comfort_up})`,
        `Setpoints ${row.heating_setpoint} / ${row.cooling_setpoint} °C`,
      ];
      return [...lines, ...overlayLines(window, overlays, index, (r) => `zone ${r.air_temperature.toFixed(1)} °C`)];
    }),
    series: [
      ...comfortBandSeries(window, palette),
      {
        name: controllerName,
        type: 'line',
        data: points(rows, (row) => row.air_temperature),
        symbol: 'none',
        lineStyle: { width: 2, color: palette.controllerLine },
        itemStyle: { color: palette.controllerLine },
        z: 5,
        markArea: operatingShade(window, palette),
        markLine: nowMarker(window, palette),
      },
      ...(showSetpoints
        ? [
            setpointSeries(SETPOINT_NAMES[0], points(rows, (row) => row.heating_setpoint), palette.heatingSetpoint),
            setpointSeries(SETPOINT_NAMES[1], points(rows, (row) => row.cooling_setpoint), palette.coolingSetpoint),
          ]
        : []),
      ...overlaySeries(window, overlays, (row) => row.air_temperature),
    ],
  };
}

/** Outdoor temperature (weather), identical for every policy. */
export function outdoorChartOption(input: BuildingChartInput): ChartOption {
  const { palette } = input;
  const window = chartWindow(input);
  return {
    ...stackedChart(window, palette, 'Outdoor temp. (°C)', [], (row) => [
      `Outdoor ${row.outdoor_temperature.toFixed(1)} °C · ${row.outdoor_humidity.toFixed(0)} % RH`,
    ]),
    series: [
      {
        name: 'Outdoor temperature',
        type: 'line',
        data: window.points(window.rows, (row) => row.outdoor_temperature),
        symbol: 'none',
        lineStyle: { width: 1.5, color: palette.outdoorTemperature },
        itemStyle: { color: palette.outdoorTemperature },
        markArea: operatingShade(window, palette),
        markLine: nowMarker(window, palette),
      },
    ],
  };
}

/** HVAC electrical power of the controller, and of the overlay policies on the same weather. */
export function powerChartOption(input: BuildingChartInput): ChartOption {
  const { palette, overlays, controllerName } = input;
  const window = chartWindow(input);
  const { rows, points } = window;
  const toKw = (row: TraceRow) => row.hvac_power / 1000;
  const legend = [controllerName, ...overlays.map(policyName)];
  const base = stackedChart(window, palette, 'HVAC power (kW)', legend, (row, index) => [
    `HVAC ${toKw(row).toFixed(2)} kW`,
    ...overlayLines(window, overlays, index, (r) => `${toKw(r).toFixed(2)} kW`),
  ]);

  return {
    ...base,
    yAxis: { ...base.yAxis, scale: false, min: 0 },
    series: [
      {
        name: controllerName,
        type: 'line',
        data: points(rows, toKw),
        symbol: 'none',
        lineStyle: { width: 1.5, color: palette.controllerLine },
        areaStyle: { color: palette.controllerFill },
        itemStyle: { color: palette.controllerLine },
        markArea: operatingShade(window, palette),
        markLine: nowMarker(window, palette),
      },
      ...overlaySeries(window, overlays, toKw),
    ],
  };
}

const policyName = (overlay: OverlaySeries): string => overlay.name;

function overlaySeries(window: ChartWindow, overlays: readonly OverlaySeries[], value: (row: TraceRow) => number) {
  return overlays.map((overlay, i) => dashedSeries(overlay.name, window.points(window.overlayRows[i] ?? [], value), overlay.color));
}

function overlayLines(
  window: ChartWindow,
  overlays: readonly OverlaySeries[],
  index: number,
  describe: (row: TraceRow) => string,
): string[] {
  return overlays.flatMap((overlay, i) => {
    const row = window.overlayRows[i]?.[index];
    return row === undefined ? [] : [`${overlay.name}: ${describe(row)}`];
  });
}

/** Drawn as an invisible lower bound plus the stacked band width, so the shading follows seasonal band changes. */
function comfortBandSeries(window: ChartWindow, palette: ChartPalette) {
  const { rows, points } = window;
  return [
    {
      name: 'comfort-base',
      type: 'line',
      stack: COMFORT_STACK,
      data: points(rows, (row) => row.comfort_low),
      symbol: 'none',
      lineStyle: { opacity: 0 },
      silent: true,
      tooltip: { show: false },
    },
    {
      name: 'comfort-band',
      type: 'line',
      stack: COMFORT_STACK,
      data: points(rows, (row) => row.comfort_up - row.comfort_low),
      symbol: 'none',
      lineStyle: { opacity: 0 },
      areaStyle: { color: palette.comfortBand },
      itemStyle: { color: palette.comfortBand },
      silent: true,
    },
  ];
}

function setpointSeries(name: string, data: number[][], color: string) {
  return {
    name,
    type: 'line',
    step: 'end',
    data,
    symbol: 'none',
    lineStyle: { width: 1.2, type: 'dotted', color },
    itemStyle: { color },
  };
}

function dashedSeries(name: string, data: number[][], color: string) {
  return {
    name,
    type: 'line',
    data,
    symbol: 'none',
    lineStyle: { width: 1.5, type: 'dashed', color },
    itemStyle: { color },
  };
}
