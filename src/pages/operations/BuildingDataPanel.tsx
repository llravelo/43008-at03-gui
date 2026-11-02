import { useMemo } from 'react';
import { EChart } from '../../charts/EChart';
import {
  outdoorChartOption,
  powerChartOption,
  temperatureChartOption,
  type OverlaySeries,
} from '../../charts/options/buildingChart';
import type { PolicySpec } from '../../bundle/manifest';
import { CheckboxMenu, Segmented } from '../../components/controls';
import { ControllerChip } from '../../components/ControllerChip';
import { Panel } from '../../components/Panel';
import { APP_CONFIG } from '../../config';
import type { Trace } from '../../domain/trace';
import { formatWindow } from '../../format';
import type { ChartLayer } from '../../state/appState';
import { useAppState } from '../../state/AppStateContext';
import { useChartPalette } from '../../theme/ThemeContext';

const CHART_GROUP = 'building-data';

interface BuildingDataPanelProps {
  trace: Trace;
  controller: PolicySpec;
  nowStep: number;
  /** Every policy offered as an overlay; the user's checkboxes pick which are drawn. */
  overlays: readonly OverlaySeries[];
}

export function BuildingDataPanel({ trace, controller, nowStep, overlays }: BuildingDataPanelProps) {
  const { state, dispatch } = useAppState();
  const { chartLayers } = state;
  const palette = useChartPalette();
  const shownOverlays = useMemo(
    () => overlays.filter((overlay) => state.overlays[overlay.key] === true),
    [overlays, state.overlays],
  );

  const options = useMemo(() => {
    const input = {
      trace,
      endStep: nowStep,
      hours: state.windowHours,
      controllerName: controller.name,
      overlays: shownOverlays,
      showSetpoints: chartLayers.setpoints,
      palette,
    };
    return {
      temperature: temperatureChartOption(input),
      outdoor: outdoorChartOption(input),
      power: powerChartOption(input),
    };
  }, [trace, controller.name, nowStep, state.windowHours, shownOverlays, chartLayers, palette]);

  const layerToggles: { layer: ChartLayer; label: string }[] = [
    { layer: 'setpoints', label: 'Setpoints' },
  ];

  return (
    <Panel
      title="Building data"
      badge={<ControllerChip policy={controller} />}
      className="building-panel"
      actions={
        <>
          {layerToggles.map(({ layer, label }) => (
            <label key={layer} className="checkbox">
              <input type="checkbox" checked={chartLayers[layer]} onChange={() => dispatch({ type: 'toggleLayer', layer })} />
              {label}
            </label>
          ))}
          {overlays.length > 0 && (
            <CheckboxMenu
              label="Baselines"
              options={overlays.map((overlay) => ({
                value: overlay.key,
                label: overlay.name,
                checked: state.overlays[overlay.key] === true,
                color: overlay.color,
              }))}
              onToggle={(policy) => dispatch({ type: 'toggleOverlay', policy })}
            />
          )}
          <Segmented
            label="Chart window"
            value={state.windowHours}
            options={APP_CONFIG.chartWindowsHours.map((hours) => ({ value: hours, label: formatWindow(hours) }))}
            onChange={(windowHours) => dispatch({ type: 'setWindow', windowHours })}
          />
        </>
      }
    >
      <div className="building-charts">
        <EChart option={options.outdoor} height="100%" group={CHART_GROUP} ariaLabel="Outdoor temperature up to now" />
        <EChart option={options.temperature} height="100%" group={CHART_GROUP} ariaLabel="Core zone temperature up to now" />
        <EChart option={options.power} height="100%" group={CHART_GROUP} ariaLabel="HVAC electrical power up to now" />
      </div>
    </Panel>
  );
}
