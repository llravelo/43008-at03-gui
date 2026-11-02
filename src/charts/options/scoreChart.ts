import type { ActionSpec, ScoreType } from '../../bundle/manifest';
import type { ChartOption } from '../echarts';
import { axisStyle, baseOption, tooltipStyle, type ChartPalette } from '../theme';

export const SCORE_TYPE_LABEL: Record<ScoreType, string> = {
  q_value: 'Q-value',
  probability: 'Probability',
};

export interface ScoreChartInput {
  scores: readonly number[];
  chosenAction: number;
  actions: readonly ActionSpec[];
  scoreType: ScoreType;
  color: string;
  palette: ChartPalette;
}

export function scoreChartOption({ scores, chosenAction, actions, scoreType, color, palette }: ScoreChartInput): ChartOption {
  const label = SCORE_TYPE_LABEL[scoreType];
  // Raw Q-values are all negative and close together, so bars hanging from the top read backwards.
  // Relative to the best action, the chosen bar sits at 0 and every other bar shows how much worse it is.
  const best = Math.max(...scores);
  const plotted = scoreType === 'q_value' ? scores.map((score) => score - best) : scores;
  const axes = axisStyle(palette);

  return {
    ...baseOption(palette),
    grid: { left: 52, right: 8, top: 20, bottom: 40 },
    tooltip: tooltipStyle(palette, {
      trigger: 'axis',
      formatter: (params: { dataIndex: number }[]) => {
        const index = params[0]?.dataIndex ?? 0;
        const action = actions[index];
        const score = scores[index];
        if (action === undefined || score === undefined) return '';
        const relative = scoreType === 'q_value' ? `<br/>vs best: ${(score - best).toFixed(3)}` : '';
        return `<b>Heating ${action.heating} °C / cooling ${action.cooling} °C</b><br/>${label}: ${score.toFixed(3)}${relative}`;
      },
    }),
    xAxis: {
      type: 'category',
      data: actions.map((action) => `${action.heating}\n${action.cooling}`),
      ...axes,
      axisLabel: {
        ...axes.axisLabel,
        interval: 0,
        fontSize: 10,
        lineHeight: 12,
        color: (_value: string, index: number) => (actions[index]?.id === chosenAction ? color : palette.mutedText),
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: scoreType === 'q_value' ? 'Q − best Q' : label,
      nameLocation: 'middle',
      nameRotate: 90,
      nameGap: 38,
      ...(scoreType === 'probability' ? { min: 0, max: 1 } : { max: 0 }),
      ...axes,
    },
    series: [
      {
        type: 'bar',
        data: plotted.map((value, index) => {
          const chosen = actions[index]?.id === chosenAction;
          return { value, itemStyle: { color: chosen ? color : palette.mutedBar } };
        }),
        barWidth: '60%',
      },
    ],
  };
}
