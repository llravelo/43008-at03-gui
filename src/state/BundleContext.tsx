import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { BundleSummary } from '../bundle/manifest';
import type { Bundle, BundleRepository } from '../bundle/repository';
import { useAsync, type AsyncState } from '../hooks/useAsync';
import { resolveSelection, type Selection } from './appState';
import { useAppState } from './AppStateContext';

interface BundleContextValue {
  summaries: AsyncState<BundleSummary[]>;
  bundle: AsyncState<Bundle>;
}

const BundleContext = createContext<BundleContextValue | null>(null);
const OpenBundleContext = createContext<Bundle | null>(null);

/** Lists bundles, selects a default one and opens the selected bundle. */
export function BundleProvider({ repository, children }: { repository: BundleRepository; children: ReactNode }) {
  const { state, dispatch } = useAppState();
  const summaries = useAsync(() => repository.listBundles(), [repository]);

  useEffect(() => {
    if (summaries.status !== 'ready' || state.bundleId !== null) return;
    const preferred = defaultBundle(summaries.data);
    if (preferred !== undefined) dispatch({ type: 'selectBundle', bundleId: preferred.id });
  }, [summaries, state.bundleId, dispatch]);

  const bundle = useAsync<Bundle>(
    () => (state.bundleId === null ? new Promise<Bundle>(() => {}) : repository.openBundle(state.bundleId)),
    [repository, state.bundleId],
  );

  return <BundleContext.Provider value={{ summaries, bundle }}>{children}</BundleContext.Provider>;
}

/** The most recently built bundle. */
function defaultBundle(summaries: readonly BundleSummary[]): BundleSummary | undefined {
  return [...summaries].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0];
}

export function useBundleContext(): BundleContextValue {
  const value = useContext(BundleContext);
  if (value === null) throw new Error('useBundleContext must be used inside <BundleProvider>');
  return value;
}

export function OpenBundleProvider({ bundle, children }: { bundle: Bundle; children: ReactNode }) {
  return <OpenBundleContext.Provider value={bundle}>{children}</OpenBundleContext.Provider>;
}

/** The opened bundle; only available inside pages, which render once a bundle is open. */
export function useBundle(): Bundle {
  const bundle = useContext(OpenBundleContext);
  if (bundle === null) throw new Error('useBundle must be used inside <OpenBundleProvider>');
  return bundle;
}

export function useSelection(): Selection {
  const { state } = useAppState();
  return resolveSelection(state, useBundle().manifest);
}
