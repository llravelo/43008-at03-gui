import type { ActionSpec } from '../bundle/manifest';
import { formatSetpoints } from './policies';
import type { Trace } from './trace';

export type EventKind = 'controller' | 'comfort_alert';

export interface OperatorEvent {
  step: number;
  kind: EventKind;
  title: string;
  detail: string;
  /** Set on controller events whose actions are both in the manifest, so the log can render setpoint chips. */
  setpointChange?: { from: ActionSpec; to: ActionSpec };
}

export interface EventContext {
  trace: Trace;
  actions: readonly ActionSpec[];
}

/** Scans a trace for one kind of event. Add detectors to extend the event log without touching existing ones. */
export type EventDetector = (context: EventContext) => OperatorEvent[];

export const controllerChangeDetector: EventDetector = ({ trace, actions }) => {
  const events: OperatorEvent[] = [];
  const actionsById = new Map(actions.map((action) => [action.id, action]));
  for (let decision = 1; decision < trace.decisionCount; decision++) {
    const step = trace.stepOfDecision(decision);
    const previous = trace.row(step - trace.timing.actionRepeat).action;
    const row = trace.row(step);
    if (row.action === previous) continue;
    const from = actionsById.get(previous);
    const to = actionsById.get(row.action);
    events.push({
      step,
      kind: 'controller',
      title: `${from === undefined ? `action ${previous}` : formatSetpoints(from)} → ${
        to === undefined ? `action ${row.action}` : formatSetpoints(to)
      }`,
      detail: row.operating ? 'Operating hours' : `Opens in ${row.hours_until_open} h`,
      ...(from !== undefined && to !== undefined && { setpointChange: { from, to } }),
    });
  }
  return events;
};

export const comfortAlertDetector: EventDetector = ({ trace }) => {
  const events: OperatorEvent[] = [];
  let alerting = false;
  trace.rows.forEach((row, step) => {
    const outside = row.operating && row.violation > 0;
    if (outside && !alerting) {
      const direction = row.air_temperature > row.comfort_up ? 'above' : 'below';
      events.push({
        step,
        kind: 'comfort_alert',
        title: `Zone ${direction} comfort band`,
        detail: `${row.air_temperature.toFixed(1)} °C (band ${row.comfort_low}–${row.comfort_up} °C)`,
      });
    }
    alerting = outside;
  });
  return events;
};

export const DEFAULT_EVENT_DETECTORS: readonly EventDetector[] = [controllerChangeDetector, comfortAlertDetector];

export function detectEvents(
  context: EventContext,
  detectors: readonly EventDetector[] = DEFAULT_EVENT_DETECTORS,
): OperatorEvent[] {
  return detectors.flatMap((detect) => detect(context)).sort((a, b) => a.step - b.step);
}

/** The `limit` most recent events at or before `step`, newest first. `events` must be sorted by step. */
export function recentEvents(events: readonly OperatorEvent[], step: number, limit: number): OperatorEvent[] {
  const end = upperBound(events, step);
  return events.slice(Math.max(0, end - limit), end).reverse();
}

function upperBound(events: readonly OperatorEvent[], step: number): number {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if ((events[mid] as OperatorEvent).step <= step) low = mid + 1;
    else high = mid;
  }
  return low;
}
