import { useMemo } from 'react';
import type { Manifest, PolicySpec } from '../../bundle/manifest';
import type { OverlaySeries } from '../../charts/options/buildingChart';
import { AsyncView } from '../../components/AsyncView';
import { APP_CONFIG } from '../../config';
import { formatClock } from '../../domain/calendar';
import type { DecisionLog } from '../../domain/decisionLog';
import { actionSpec, findPolicy, overlayPoliciesFor } from '../../domain/policies';
import type { Trace } from '../../domain/trace';
import { combineAsync } from '../../hooks/useAsync';
import { useDecisions, useTraces } from '../../hooks/useBundleData';
import { usePlayback } from '../../hooks/usePlayback';
import { useAppState } from '../../state/AppStateContext';
import { useBundle, useSelection } from '../../state/BundleContext';
import { AgentPanel } from './AgentPanel';
import { ComfortViolationPanel, EnergySavingsPanel, type ComparedController } from './ComparisonPanels';
import { BuildingDataPanel } from './BuildingDataPanel';
import { EventLogPanel } from './EventLogPanel';
import { KpiRow } from './KpiRow';
import { OPERATIONS_KPIS } from './kpis';
import { PlaybackBar } from './PlaybackBar';

export function OperationsPage() {
  const { manifest } = useBundle();
  const { climate, policy } = useSelection();
  const controller = findPolicy(manifest, policy);
  const references = useMemo(
    () => overlayPoliciesFor(manifest, policy, APP_CONFIG.comparisonPolicies),
    [manifest, policy],
  );
  const overlayPolicies = useMemo(
    () => overlayPoliciesFor(manifest, policy, APP_CONFIG.overlayPolicies),
    [manifest, policy],
  );
  // The controller first, then every other policy the page compares against, each loaded once.
  const policyKeys = useMemo(
    () => [...new Set([policy, ...references.map((p) => p.key), ...overlayPolicies.map((p) => p.key)])],
    [policy, references, overlayPolicies],
  );
  const traces = useTraces(climate, policyKeys);
  const decisions = useDecisions(climate, policy);

  if (controller === undefined) return null;
  return (
    <AsyncView state={combineAsync([traces, decisions] as const)} loadingText="Loading simulation year…">
      {([loaded, decisionLog]) => {
        const tracesByPolicy = new Map(policyKeys.map((key, i) => [key, loaded[i]]));
        const trace = tracesByPolicy.get(policy);
        if (trace === undefined) return null;
        const misaligned = policyKeys.find((key) => !trace.isAlignedWith(tracesByPolicy.get(key) ?? trace));
        if (misaligned !== undefined) {
          return (
            <p className="status status-error">
              The traces of {controller.name} and {findPolicy(manifest, misaligned)?.name} cover different timestamps.
            </p>
          );
        }
        return (
          <OperationsView
            manifest={manifest}
            climateLabel={manifest.climates.find((c) => c.key === climate)?.label ?? climate}
            controller={controller}
            trace={trace}
            comparisons={[...references, controller].flatMap((p) => {
              const comparedTrace = tracesByPolicy.get(p.key);
              return comparedTrace === undefined ? [] : [{ policy: p, trace: comparedTrace }];
            })}
            overlays={overlayPolicies.flatMap((p) => {
              const overlayTrace = tracesByPolicy.get(p.key);
              return overlayTrace === undefined ? [] : [{ key: p.key, name: p.name, color: p.color, trace: overlayTrace }];
            })}
            decisions={decisionLog}
          />
        );
      }}
    </AsyncView>
  );
}

interface OperationsViewProps {
  manifest: Manifest;
  climateLabel: string;
  controller: PolicySpec;
  trace: Trace;
  /** The policies of the comparison panels, with the controller last. */
  comparisons: readonly ComparedController[];
  overlays: readonly OverlaySeries[];
  decisions: DecisionLog | null;
}

function OperationsView({ manifest, climateLabel, controller, trace, comparisons, overlays, decisions }: OperationsViewProps) {
  const { state } = useAppState();
  const maxCursor = trace.decisionCount - 1;
  usePlayback(maxCursor);

  const cursor = Math.min(state.cursor, maxCursor);
  const nowStep = trace.stepOfDecision(cursor);
  const row = trace.row(nowStep);
  const action = actionSpec(manifest, row.action);

  return (
    <div className="operations">
      <header className="page-header">
        <div>
          <h1>Building control dashboard</h1>
          <p className="subtitle">5Zone office · {climateLabel} climate</p>
        </div>
        <time className="clock">{formatClock(trace.timestamps[nowStep] ?? 0)}</time>
      </header>
      <PlaybackBar maxCursor={maxCursor} />
      <div className="operations-grid">
        <div className="operations-main">
          <KpiRow row={row} kpis={OPERATIONS_KPIS} />
          <BuildingDataPanel trace={trace} controller={controller} nowStep={nowStep} overlays={overlays} />
        </div>
        <div className="operations-side">
          <AgentPanel
            controller={controller}
            action={action}
            actions={manifest.actions}
            decision={decisions?.at(cursor) ?? null}
          />
          <EnergySavingsPanel policies={comparisons} baselineKey={APP_CONFIG.baselinePolicy} nowStep={nowStep} />
          <ComfortViolationPanel policies={comparisons} baselineKey={APP_CONFIG.baselinePolicy} nowStep={nowStep} />
        </div>
        <div className="operations-full">
          <EventLogPanel trace={trace} actions={manifest.actions} nowStep={nowStep} />
        </div>
      </div>
    </div>
  );
}
