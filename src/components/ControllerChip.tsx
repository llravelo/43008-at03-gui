import type { CSSProperties } from 'react';
import type { PolicySpec } from '../bundle/manifest';

export function ControllerChip({ policy }: { policy: PolicySpec }) {
  return (
    <span className="controller-chip" style={{ '--chip-color': policy.color } as CSSProperties}>
      <span className="dot" aria-hidden="true" />
      {policy.name}
    </span>
  );
}
