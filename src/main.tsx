import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ParquetTableReader } from './bundle/tableReader';
import { StaticBundleRepository } from './bundle/repository';
import { APP_CONFIG } from './config';
import { AppStateProvider } from './state/AppStateContext';
import { BundleProvider } from './state/BundleContext';
import type { AppState } from './state/appState';
import { applyColorScheme, initialColorScheme } from './theme/colorScheme';
import { ThemeProvider } from './theme/ThemeContext';
import './styles.css';

// Composition root: the only place that picks concrete implementations.
const repository = new StaticBundleRepository(APP_CONFIG.bundlesBaseUrl, new ParquetTableReader());

const initialState: AppState = {
  bundleId: null,
  climate: null,
  policy: null,
  cursor: APP_CONFIG.initialCursor,
  playing: false,
  speedHours: APP_CONFIG.playbackSpeedsHours[0],
  windowHours: APP_CONFIG.chartWindowsHours[1],
  chartLayers: { setpoints: false },
  overlays: Object.fromEntries(APP_CONFIG.initialOverlays.map((policy) => [policy, true])),
};

// Applied before the first render so a dark-mode viewer never sees a light flash.
const colorScheme = APP_CONFIG.showThemeToggle ? initialColorScheme() : APP_CONFIG.fixedColorScheme;
applyColorScheme(colorScheme);

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider initialScheme={colorScheme}>
      <AppStateProvider initialState={initialState}>
        <BundleProvider repository={repository}>
          <App />
        </BundleProvider>
      </AppStateProvider>
    </ThemeProvider>
  </StrictMode>,
);
