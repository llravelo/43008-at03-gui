import type { PolicySpec } from '../../bundle/manifest';
import { Panel } from '../../components/Panel';
import { PolicySwatch } from '../../components/PolicySwatch';
import { periodTotals, type PeriodTotalsByPeriod } from '../../domain/comparison';
import { relativeChangePct } from '../../domain/policies';
import type { PeriodTotals, Trace } from '../../domain/trace';
import { formatNumber, formatSigned } from '../../format';

export interface ComparedController {
  policy: PolicySpec;
  trace: Trace;
}

interface ComparisonPanelProps {
  /** Table columns, in order. */
  policies: readonly ComparedController[];
  /** Policy every other column is measured against. */
  baselineKey: string;
  nowStep: number;
}

const PERIODS: readonly { period: keyof PeriodTotalsByPeriod; label: string; short: string }[] = [
  { period: 'today', label: 'Today', short: 'today' },
  { period: 'yearToDate', label: 'Year to date', short: 'YTD' },
];

export function EnergySavingsPanel(props: ComparisonPanelProps) {
  return (
    <ComparisonTable
      {...props}
      title="Energy savings"
      unit="kWh"
      value={(totals) => formatNumber(totals.energyKWh, 0)}
      deltaLabel="Saving"
      deltaTitle={(policy, baseline) => `Energy ${policy} saves relative to ${baseline}`}
      // Positive = the policy used less energy than the baseline.
      delta={(totals, baseline) => {
        const change = relativeChangePct(totals.energyKWh, baseline.energyKWh);
        return change === null ? null : -change;
      }}
      deltaUnit="%"
      higherIsBetter
    />
  );
}

export function ComfortViolationPanel(props: ComparisonPanelProps) {
  return (
    <ComparisonTable
      {...props}
      title="Comfort violation"
      unit="h"
      value={(totals) => formatNumber(totals.violationHours, totals.violationHours < 10 ? 2 : 1)}
      deltaLabel="Δ"
      deltaTitle={(policy, baseline) => `Violation hours of ${policy} minus ${baseline}`}
      delta={(totals, baseline) => totals.violationHours - baseline.violationHours}
      deltaUnit="h"
      higherIsBetter={false}
    />
  );
}

interface ComparisonTableProps extends ComparisonPanelProps {
  title: string;
  /** Unit of the total rows, shown once in the header corner so four columns fit a narrow panel. */
  unit: string;
  value: (totals: PeriodTotals) => string;
  deltaLabel: string;
  deltaTitle: (policy: string, baseline: string) => string;
  delta: (totals: PeriodTotals, baseline: PeriodTotals) => number | null;
  deltaUnit: string;
  higherIsBetter: boolean;
}

function ComparisonTable({
  policies,
  baselineKey,
  nowStep,
  title,
  unit,
  value,
  deltaLabel,
  deltaTitle,
  delta,
  deltaUnit,
  higherIsBetter,
}: ComparisonTableProps) {
  const baseline = policies.find((p) => p.policy.key === baselineKey);
  if (baseline === undefined || policies.length < 2) {
    return (
      <Panel title={title}>
        <p className="panel-note">This bundle has no baseline policy “{baselineKey}” to compare against.</p>
      </Panel>
    );
  }
  const totals = policies.map((p) => periodTotals(p.trace, nowStep));
  const baselineTotals = periodTotals(baseline.trace, nowStep);

  return (
    <Panel title={title}>
      <table className="data-table compact">
        <thead>
          <tr>
            <th className="table-unit">{unit}</th>
            {policies.map(({ policy }) => (
              <th key={policy.key} className="numeric">
                <PolicySwatch color={policy.color} /> {policy.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map(({ period, label }) => (
            <tr key={period}>
              <th scope="row">{label}</th>
              {policies.map(({ policy }, i) => (
                <td key={policy.key} className="numeric">
                  {value(totals[i]![period])}
                </td>
              ))}
            </tr>
          ))}
          {PERIODS.map(({ period, short }) => (
            <tr key={`delta-${period}`}>
              <th scope="row">
                {deltaLabel} {short}
              </th>
              {policies.map(({ policy }, i) => {
                if (policy.key === baselineKey) {
                  return (
                    <td key={policy.key} className="numeric">
                      –
                    </td>
                  );
                }
                const change = delta(totals[i]![period], baselineTotals[period]);
                return (
                  <td
                    key={policy.key}
                    className={`numeric ${tone(change ?? 0, higherIsBetter)}`}
                    title={deltaTitle(policy.name, baseline.policy.name)}
                  >
                    {formatSigned(change, 1, deltaUnit)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function tone(change: number, higherIsBetter: boolean): string {
  const better = higherIsBetter ? change > 0 : change < 0;
  const worse = higherIsBetter ? change < 0 : change > 0;
  if (better) return 'positive';
  return worse ? 'negative' : '';
}
