export interface Run<K> {
  key: K;
  /** Index of the first item in the run. */
  start: number;
  /** Index of the last item in the run (inclusive). */
  end: number;
}

/** Groups consecutive items with equal keys; items whose key is null are skipped. */
export function contiguousRuns<T, K>(items: readonly T[], keyOf: (item: T) => K | null, equals = Object.is): Run<K>[] {
  const runs: Run<K>[] = [];
  let current: Run<K> | null = null;
  for (let index = 0; index < items.length; index++) {
    const key = keyOf(items[index] as T);
    if (key === null) {
      current = null;
    } else if (current !== null && equals(current.key, key)) {
      current.end = index;
    } else {
      current = { key, start: index, end: index };
      runs.push(current);
    }
  }
  return runs;
}
