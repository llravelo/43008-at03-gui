import type { Manifest } from '../bundle/manifest';
import { controllerPolicies } from '../domain/policies';

/** Optional layers of the building-data charts, each toggled by a checkbox. */
export type ChartLayer = 'setpoints';

export interface AppState {
  bundleId: string | null;
  climate: string | null;
  policy: string | null;
  /** "Now" as an hourly decision index into the year. */
  cursor: number;
  playing: boolean;
  speedHours: number;
  windowHours: number;
  chartLayers: Record<ChartLayer, boolean>;
  /** Policy key → whether its dashed overlay is shown. */
  overlays: Record<string, boolean>;
}

export type AppAction =
  | { type: 'selectBundle'; bundleId: string }
  | { type: 'selectClimate'; climate: string }
  | { type: 'selectPolicy'; policy: string }
  | { type: 'seek'; cursor: number; maxCursor: number }
  | { type: 'advance'; hours: number; maxCursor: number }
  | { type: 'setPlaying'; playing: boolean }
  | { type: 'setSpeed'; speedHours: number }
  | { type: 'setWindow'; windowHours: number }
  | { type: 'toggleLayer'; layer: ChartLayer }
  | { type: 'toggleOverlay'; policy: string };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'selectBundle':
      return { ...state, bundleId: action.bundleId, playing: false };
    case 'selectClimate':
      return { ...state, climate: action.climate };
    case 'selectPolicy':
      return { ...state, policy: action.policy };
    case 'seek':
      return { ...state, cursor: clamp(action.cursor, 0, action.maxCursor) };
    case 'advance': {
      const cursor = clamp(state.cursor + action.hours, 0, action.maxCursor);
      return { ...state, cursor, playing: state.playing && cursor < action.maxCursor };
    }
    case 'setPlaying':
      return { ...state, playing: action.playing };
    case 'setSpeed':
      return { ...state, speedHours: action.speedHours };
    case 'setWindow':
      return { ...state, windowHours: action.windowHours };
    case 'toggleLayer':
      return { ...state, chartLayers: { ...state.chartLayers, [action.layer]: !state.chartLayers[action.layer] } };
    case 'toggleOverlay':
      return { ...state, overlays: { ...state.overlays, [action.policy]: !state.overlays[action.policy] } };
  }
}

export interface Selection {
  climate: string;
  policy: string;
}

/** Valid climate/policy for a bundle: the user's choice when the bundle has it, otherwise sensible defaults. */
export function resolveSelection(state: AppState, manifest: Manifest): Selection {
  const climates = manifest.climates.map((climate) => climate.key);
  const policies = controllerPolicies(manifest).map((policy) => policy.key);
  const defaultClimate = climates.includes(manifest.train_climate) ? manifest.train_climate : manifest.climates[0].key;
  const defaultPolicy = policies[0]!;
  return {
    climate: state.climate !== null && climates.includes(state.climate) ? state.climate : defaultClimate,
    policy: state.policy !== null && policies.includes(state.policy) ? state.policy : defaultPolicy,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
