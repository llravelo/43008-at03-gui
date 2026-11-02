import type { TraceRow } from '../../bundle/columns';
import type { KpiDescriptor } from './kpis';

export function KpiRow({ row, kpis }: { row: TraceRow; kpis: readonly KpiDescriptor[] }) {
  return (
    <div className="kpi-row">
      {kpis.map((kpi) => (
        <article key={kpi.id} className={`kpi kpi-${kpi.tone?.(row) ?? 'neutral'}`}>
          <h3>{kpi.label}</h3>
          <p className="kpi-value">{kpi.value(row)}</p>
        </article>
      ))}
    </div>
  );
}
