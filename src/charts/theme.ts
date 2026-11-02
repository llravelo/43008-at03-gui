import type { ColorScheme } from '../theme/colorScheme';

/** Chart colours per colour scheme; policy colours come from the bundle manifest. Light follows the notebook style. */
export interface ChartPalette {
  text: string;
  mutedText: string;
  axis: string;
  grid: string;
  surface: string;
  tooltipBackground: string;
  tooltipBorder: string;
  comfortBand: string;
  operatingShade: string;
  /** The selected controller's lines; overlays use their policy colours. */
  controllerLine: string;
  controllerFill: string;
  outdoorTemperature: string;
  heatingSetpoint: string;
  coolingSetpoint: string;
  mutedBar: string;
}

export const CHART_PALETTES: Record<ColorScheme, ChartPalette> = {
  light: {
    text: '#52514e',
    mutedText: '#898781',
    axis: '#898781',
    grid: '#e4e3df',
    surface: '#fcfcfb',
    tooltipBackground: '#ffffff',
    tooltipBorder: '#e4e3df',
    comfortBand: 'rgba(205, 226, 251, 0.75)',
    operatingShade: 'rgba(240, 239, 236, 0.9)',
    controllerLine: '#33322f',
    controllerFill: 'rgba(51, 50, 47, 0.08)',
    outdoorTemperature: '#898781',
    heatingSetpoint: '#d9534f',
    coolingSetpoint: '#2a78d6',
    mutedBar: '#cfcdc7',
  },
  dark: {
    text: '#c4c2bc',
    mutedText: '#8f8d87',
    axis: '#5c5a55',
    grid: '#2f2e2b',
    surface: '#1c1c1b',
    tooltipBackground: '#262624',
    tooltipBorder: '#3a3935',
    comfortBand: 'rgba(91, 156, 240, 0.22)',
    operatingShade: 'rgba(255, 255, 255, 0.06)',
    controllerLine: '#f2f1ee',
    controllerFill: 'rgba(242, 241, 238, 0.1)',
    outdoorTemperature: '#8f8d87',
    heatingSetpoint: '#f07470',
    coolingSetpoint: '#5b9cf0',
    mutedBar: '#4a4945',
  },
};

export function baseOption(palette: ChartPalette) {
  return {
    animation: false,
    useUTC: true,
    textStyle: { color: palette.text, fontFamily: 'inherit' },
  } as const;
}

export function axisStyle(palette: ChartPalette) {
  return {
    axisLine: { lineStyle: { color: palette.axis } },
    axisLabel: { color: palette.mutedText },
    nameTextStyle: { color: palette.mutedText },
    splitLine: { lineStyle: { color: palette.grid } },
  } as const;
}

export function legendStyle(palette: ChartPalette, extra: Record<string, unknown> = {}) {
  return { top: 0, textStyle: { color: palette.text }, inactiveColor: palette.axis, ...extra };
}

export function tooltipStyle(palette: ChartPalette, extra: Record<string, unknown>) {
  return {
    backgroundColor: palette.tooltipBackground,
    borderColor: palette.tooltipBorder,
    textStyle: { color: palette.text },
    ...extra,
  };
}
