import type { ReactNode } from 'react';
import type { AsyncState } from '../hooks/useAsync';

interface AsyncViewProps<T> {
  state: AsyncState<T>;
  loadingText?: string;
  children: (data: T) => ReactNode;
}

/** Renders loading and error states uniformly; `children` receives the data once ready. */
export function AsyncView<T>({ state, loadingText = 'Loading…', children }: AsyncViewProps<T>) {
  switch (state.status) {
    case 'loading':
      return <p className="status">{loadingText}</p>;
    case 'error':
      return (
        <div className="status status-error" role="alert">
          <strong>Could not load data.</strong>
          <code>{state.error.message}</code>
        </div>
      );
    case 'ready':
      return <>{children(state.data)}</>;
  }
}
