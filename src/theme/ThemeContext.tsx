import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CHART_PALETTES, type ChartPalette } from '../charts/theme';
import { applyColorScheme, storeColorScheme, type ColorScheme } from './colorScheme';

interface ThemeContextValue {
  scheme: ColorScheme;
  toggle: () => void;
  palette: ChartPalette;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ initialScheme, children }: { initialScheme: ColorScheme; children: ReactNode }) {
  const [scheme, setScheme] = useState(initialScheme);

  useEffect(() => {
    applyColorScheme(scheme);
    storeColorScheme(scheme);
  }, [scheme]);

  const value: ThemeContextValue = {
    scheme,
    toggle: () => setScheme((current) => (current === 'dark' ? 'light' : 'dark')),
    palette: CHART_PALETTES[scheme],
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}

export function useChartPalette(): ChartPalette {
  return useTheme().palette;
}
