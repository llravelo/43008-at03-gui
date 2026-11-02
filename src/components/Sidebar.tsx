import type { Manifest } from '../bundle/manifest';
import { controllerPolicies } from '../domain/policies';
import { resolveSelection } from '../state/appState';
import { useAppState } from '../state/AppStateContext';
import { useBundleContext } from '../state/BundleContext';
import { useTheme } from '../theme/ThemeContext';
import { Select } from './controls';

export function Sidebar() {
  const { state, dispatch } = useAppState();
  const { summaries, bundle } = useBundleContext();
  const manifest = bundle.status === 'ready' ? bundle.data.manifest : null;
  const multipleBundles = summaries.status === 'ready' && summaries.data.length > 1;

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          C
        </span>
        <div className="brand-name">
          <strong>Cadence</strong>
          <span>HVAC operations</span>
        </div>
      </div>
      <div className="sidebar-controls">
        {multipleBundles && summaries.status === 'ready' && state.bundleId !== null && (
          <Select
            label="Data bundle"
            value={state.bundleId}
            options={summaries.data.map((summary) => ({ value: summary.id, label: summary.id }))}
            onChange={(bundleId) => dispatch({ type: 'selectBundle', bundleId })}
          />
        )}
        {manifest !== null && <SelectionControls manifest={manifest} />}
      </div>
      <ThemeToggle />
      {manifest !== null && multipleBundles && <BundleInfo manifest={manifest} />}
    </aside>
  );
}

function SelectionControls({ manifest }: { manifest: Manifest }) {
  const { state, dispatch } = useAppState();
  const selection = resolveSelection(state, manifest);
  return (
    <>
      <Select
        label="Climate"
        value={selection.climate}
        options={manifest.climates.map((climate) => ({ value: climate.key, label: climate.label }))}
        onChange={(climate) => dispatch({ type: 'selectClimate', climate })}
      />
      <Select
        label="Controller"
        value={selection.policy}
        options={controllerPolicies(manifest).map((policy) => ({ value: policy.key, label: policy.name }))}
        onChange={(policy) => dispatch({ type: 'selectPolicy', policy })}
      />
    </>
  );
}

function ThemeToggle() {
  const { scheme, toggle } = useTheme();
  const dark = scheme === 'dark';
  return (
    <button type="button" className="theme-toggle" role="switch" aria-checked={dark} onClick={toggle}>
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
      Dark mode
    </button>
  );
}

function BundleInfo({ manifest }: { manifest: Manifest }) {
  return (
    <footer className="bundle-info">
      <p>
        Bundle <code>{manifest.bundle_id}</code> · built {manifest.created_at.slice(0, 10)}
      </p>
    </footer>
  );
}
