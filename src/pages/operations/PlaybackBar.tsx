import { Segmented } from '../../components/controls';
import { APP_CONFIG } from '../../config';
import { formatWindow } from '../../format';
import { useAppState } from '../../state/AppStateContext';

const HOURS_PER_DAY = 24;

export function PlaybackBar({ maxCursor }: { maxCursor: number }) {
  const { state, dispatch } = useAppState();
  const seek = (cursor: number) => dispatch({ type: 'seek', cursor, maxCursor });

  return (
    <div className="playback">
      <div className="playback-buttons">
        <button type="button" onClick={() => seek(state.cursor - HOURS_PER_DAY)} aria-label="Back one day">
          ◀◀
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => dispatch({ type: 'setPlaying', playing: !state.playing })}
          aria-label={state.playing ? 'Pause' : 'Play'}
        >
          {state.playing ? '❚❚' : '▶'}
        </button>
        <button type="button" onClick={() => seek(state.cursor + HOURS_PER_DAY)} aria-label="Forward one day">
          ▶▶
        </button>
      </div>
      <Segmented
        label="Playback speed"
        value={state.speedHours}
        options={APP_CONFIG.playbackSpeedsHours.map((hours) => ({ value: hours, label: `${formatWindow(hours)}/tick` }))}
        onChange={(speedHours) => dispatch({ type: 'setSpeed', speedHours })}
      />
      <input
        className="playback-slider"
        type="range"
        min={0}
        max={maxCursor}
        value={Math.min(state.cursor, maxCursor)}
        onChange={(event) => seek(Number(event.target.value))}
        aria-label="Time of year"
      />
      <span className="playback-day">
        Day {Math.floor(Math.min(state.cursor, maxCursor) / HOURS_PER_DAY) + 1} of {Math.ceil((maxCursor + 1) / HOURS_PER_DAY)}
      </span>
    </div>
  );
}
