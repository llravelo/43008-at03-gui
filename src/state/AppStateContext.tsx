import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import { appReducer, type AppAction, type AppState } from './appState';

interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ initialState, children }: { initialState: AppState; children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const value = useContext(AppStateContext);
  if (value === null) throw new Error('useAppState must be used inside <AppStateProvider>');
  return value;
}
