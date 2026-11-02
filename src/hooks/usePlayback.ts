import { useEffect } from 'react';
import { APP_CONFIG } from '../config';
import { useAppState } from '../state/AppStateContext';

/** While playing, advances "now" by the selected speed on a fixed interval. */
export function usePlayback(maxCursor: number): void {
  const { state, dispatch } = useAppState();
  const { playing, speedHours } = state;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => dispatch({ type: 'advance', hours: speedHours, maxCursor }),
      APP_CONFIG.playbackIntervalMs,
    );
    return () => clearInterval(timer);
  }, [playing, speedHours, maxCursor, dispatch]);
}
