import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  /** Shown before the title, e.g. a chip naming whose data the panel shows. */
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, badge, actions, className, children }: PanelProps) {
  return (
    <section className={`panel ${className ?? ''}`}>
      <header className="panel-header">
        <div className="panel-title">
          {badge}
          <h2>{title}</h2>
        </div>
        {actions !== undefined && <div className="panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
