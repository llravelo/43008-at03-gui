import { useState } from 'react';
import type { ActionSpec } from '../../bundle/manifest';

/**
 * Mock-up of an operator override. The dashboard replays a recorded year, so nothing here reaches the data:
 * the form only keeps its own state to show how an intervention would be entered.
 */

const HEATING_RANGE = { min: 12, max: 21 } as const;
const COOLING_RANGE = { min: 23, max: 30 } as const;
const STEP = 0.5;
/** Minimum gap between heating and cooling setpoints, as in the agent's action set. */
const MIN_DEADBAND = 2;

export function ManualOverride({ agentAction }: { agentAction: ActionSpec | undefined }) {
  const [heating, setHeating] = useState(agentAction?.heating ?? 20);
  const [cooling, setCooling] = useState(agentAction?.cooling ?? 23.5);
  const [applied, setApplied] = useState(false);

  return (
    <div className="override">
      <div className="override-steppers">
        <Stepper
          label="Heating"
          className="setpoint-heating"
          value={heating}
          min={HEATING_RANGE.min}
          max={Math.min(HEATING_RANGE.max, cooling - MIN_DEADBAND)}
          onChange={setHeating}
          disabled={applied}
        />
        <Stepper
          label="Cooling"
          className="setpoint-cooling"
          value={cooling}
          min={Math.max(COOLING_RANGE.min, heating + MIN_DEADBAND)}
          max={COOLING_RANGE.max}
          onChange={setCooling}
          disabled={applied}
        />
      </div>
      {applied ? (
        <div className="override-status">
          <p>
            <strong>Override active</strong> · {heating} / {cooling} °C until released
          </p>
          <button type="button" className="override-button" onClick={() => setApplied(false)}>
            Release
          </button>
        </div>
      ) : (
        <button type="button" className="override-button primary" onClick={() => setApplied(true)}>
          Apply override
        </button>
      )}
      <p className="override-preview">Preview only</p>
    </div>
  );
}

interface StepperProps {
  label: string;
  className: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

function Stepper({ label, className, value, min, max, onChange, disabled }: StepperProps) {
  return (
    <div className={`setpoint stepper ${className}`}>
      <span>{label}</span>
      <div className="stepper-row">
        <button
          type="button"
          aria-label={`Lower ${label.toLowerCase()} setpoint`}
          disabled={disabled || value - STEP < min}
          onClick={() => onChange(value - STEP)}
        >
          −
        </button>
        <strong>{value} °C</strong>
        <button
          type="button"
          aria-label={`Raise ${label.toLowerCase()} setpoint`}
          disabled={disabled || value + STEP > max}
          onClick={() => onChange(value + STEP)}
        >
          +
        </button>
      </div>
    </div>
  );
}
