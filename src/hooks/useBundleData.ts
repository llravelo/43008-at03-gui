import type { DecisionLog } from '../domain/decisionLog';
import type { Trace } from '../domain/trace';
import { useBundle } from '../state/BundleContext';
import { useAsync, type AsyncState } from './useAsync';

export function useTraces(climate: string, policies: readonly string[]): AsyncState<Trace[]> {
  const bundle = useBundle();
  return useAsync(
    () => Promise.all(policies.map((policy) => bundle.trace(climate, policy))),
    [bundle, climate, policies.join('|')],
  );
}

export function useDecisions(climate: string, policy: string): AsyncState<DecisionLog | null> {
  const bundle = useBundle();
  return useAsync(() => bundle.decisions(climate, policy), [bundle, climate, policy]);
}
