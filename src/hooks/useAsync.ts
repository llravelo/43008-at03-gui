import { useEffect, useState, type DependencyList } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: T };

/** Runs `load` whenever `deps` (the inputs of `load`) change and ignores results from superseded runs. */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    load().then(
      (data) => current && setState({ status: 'ready', data }),
      (error: unknown) => current && setState({ status: 'error', error: toError(error) }),
    );
    return () => {
      current = false;
    };
  }, deps);

  return state;
}

/** Ready only when every input is ready; the first error wins over loading. */
export function combineAsync<T extends readonly unknown[]>(states: { [K in keyof T]: AsyncState<T[K]> }): AsyncState<T> {
  const list = states as readonly AsyncState<unknown>[];
  const failed = list.find((state) => state.status === 'error');
  if (failed !== undefined) return failed as AsyncState<T>;
  if (list.some((state) => state.status === 'loading')) return { status: 'loading' };
  return { status: 'ready', data: list.map((state) => (state as { data: unknown }).data) as unknown as T };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
