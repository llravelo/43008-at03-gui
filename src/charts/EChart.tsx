import { useEffect, useRef } from 'react';
import { echarts, type ChartOption } from './echarts';

interface EChartProps {
  option: ChartOption;
  /** Pixels, or a CSS length such as '100%' to fill a sized parent. */
  height: number | string;
  ariaLabel: string;
  /** Charts in the same group share the hover cursor and tooltip. */
  group?: string;
}

/** Thin React wrapper: one chart instance per mount, the option replaced on every change. */
export function EChart({ option, height, ariaLabel, group }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const chart = echarts.init(container);
    chartRef.current = chart;
    if (group !== undefined) {
      chart.group = group;
      echarts.connect(group);
    }
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [group]);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={containerRef} role="img" aria-label={ariaLabel} style={{ height, width: '100%' }} />;
}
