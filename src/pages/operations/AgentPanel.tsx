import { useMemo, useState } from 'react';
import type { DecisionRow } from '../../bundle/columns';
import type { ActionSpec, PolicySpec, ScoreType } from '../../bundle/manifest';
import { EChart } from '../../charts/EChart';
import { scoreChartOption } from '../../charts/options/scoreChart';
import { Segmented } from '../../components/controls';
import { Panel } from '../../components/Panel';
import { useChartPalette } from '../../theme/ThemeContext';
import { ManualOverride } from './ManualOverride';

interface AgentPanelProps {
  controller: PolicySpec;
  action: ActionSpec | undefined;
  actions: readonly ActionSpec[];
  /** Null when the bundle has no decision table for this controller. */
  decision: DecisionRow | null;
}

type ControlMode = 'autonomous' | 'manual';
const CONTROL_MODES: readonly { value: ControlMode; label: string }[] = [
  { value: 'autonomous', label: 'Autonomous' },
  { value: 'manual', label: 'Manual' },
];

export function AgentPanel({ controller, action, actions, decision }: AgentPanelProps) {
  const [mode, setMode] = useState<ControlMode>('autonomous');
  return (
    <Panel
      title="Current setpoint"
      className="agent-panel"
      actions={<Segmented label="Control mode" value={mode} options={CONTROL_MODES} onChange={setMode} />}
    >
      <SetpointCard action={action} />
      <div className="agent-body">
        {mode === 'manual' ? (
          <ManualOverride agentAction={action} />
        ) : decision === null ? (
          <p className="panel-note">This bundle has no decision data for {controller.name}; the action scores are hidden.</p>
        ) : (
          <DecisionScores controller={controller} actions={actions} decision={decision} />
        )}
      </div>
    </Panel>
  );
}

function SetpointCard({ action }: { action: ActionSpec | undefined }) {
  if (action === undefined) return <p className="status status-error">Unknown action</p>;
  return (
    <div className="setpoints">
      <div className="setpoint setpoint-heating">
        <span>Heating</span>
        <strong>{action.heating} °C</strong>
      </div>
      <div className="setpoint setpoint-cooling">
        <span>Cooling</span>
        <strong>{action.cooling} °C</strong>
      </div>
    </div>
  );
}

interface DecisionScoresProps {
  controller: PolicySpec;
  actions: readonly ActionSpec[];
  decision: DecisionRow;
}

function DecisionScores({ controller, actions, decision }: DecisionScoresProps) {
  const { score_type: scoreType } = controller;
  if (scoreType === null || decision.scores === null) {
    return <p className="panel-note">{controller.name} is a fixed baseline: it has no learned action scores.</p>;
  }
  return <ScoreChart scores={decision.scores} scoreType={scoreType} decision={decision} actions={actions} color={controller.color} />;
}

interface ScoreChartProps {
  scores: readonly number[];
  scoreType: ScoreType;
  decision: DecisionRow;
  actions: readonly ActionSpec[];
  color: string;
}

function ScoreChart({ scores, scoreType, decision, actions, color }: ScoreChartProps) {
  const palette = useChartPalette();
  const option = useMemo(
    () => scoreChartOption({ scores, chosenAction: decision.action, actions, scoreType, color, palette }),
    [scores, decision.action, actions, scoreType, color, palette],
  );
  return (
    <>
      <EChart option={option} height={190} ariaLabel="Score of each setpoint action for the current decision" />
      <p className="panel-note">
        {scoreType === 'q_value'
          ? 'Q-value relative to the best setpoint pair.'
          : 'Policy probability of each setpoint pair.'}
      </p>
    </>
  );
}
