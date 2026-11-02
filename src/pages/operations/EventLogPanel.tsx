import { useId, useMemo, useState } from 'react';
import type { ActionSpec } from '../../bundle/manifest';
import { Panel } from '../../components/Panel';
import { APP_CONFIG } from '../../config';
import { formatClock } from '../../domain/calendar';
import { detectEvents, recentEvents, type EventKind } from '../../domain/events';
import type { Trace } from '../../domain/trace';

const KIND_LABEL: Record<EventKind, string> = {
  controller: 'Setpoint',
  comfort_alert: 'Alert',
};

export function EventLogPanel({ trace, actions, nowStep }: { trace: Trace; actions: readonly ActionSpec[]; nowStep: number }) {
  const events = useMemo(() => detectEvents({ trace, actions }), [trace, actions]);
  const recent = recentEvents(events, nowStep, APP_CONFIG.eventLogLength);
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <Panel
      title="Event log"
      className="event-panel"
      actions={
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Hide' : 'Show'}
          <span className="panel-toggle-chevron" aria-hidden="true" />
        </button>
      }
    >
      {!open ? null : recent.length === 0 ? (
        <p id={bodyId} className="panel-note">
          No events yet.
        </p>
      ) : (
        <ol id={bodyId} className="event-log">
          {recent.map((event) => (
            <li key={`${event.kind}-${event.step}`} className={`event event-${event.kind}`}>
              <time>{formatClock(trace.timestamps[event.step] ?? 0)}</time>
              <span className="event-kind">{KIND_LABEL[event.kind]}</span>
              {event.setpointChange === undefined ? (
                <span className="event-title">{event.title}</span>
              ) : (
                <span className="event-title event-setpoints">
                  <SetpointChips action={event.setpointChange.from} />
                  <span className="event-arrow" aria-hidden="true">
                    →
                  </span>
                  <SetpointChips action={event.setpointChange.to} />
                </span>
              )}
              <span className="event-detail">{event.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function SetpointChips({ action }: { action: ActionSpec }) {
  return (
    <span className="setpoint-chips">
      <span className="setpoint-chip setpoint-chip-heating" title="Heating setpoint">{action.heating} °C</span>
      <span className="setpoint-chip setpoint-chip-cooling" title="Cooling setpoint">{action.cooling} °C</span>
    </span>
  );
}
