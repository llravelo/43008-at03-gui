import type { ActionSpec, Manifest, PolicySpec } from '../bundle/manifest';

export function findPolicy(manifest: Manifest, key: string): PolicySpec | undefined {
  return manifest.policies.find((policy) => policy.key === key);
}

/** Policies offered as the controller: the RL agents; baselines only appear as comparisons and overlays. */
export function controllerPolicies(manifest: Manifest): PolicySpec[] {
  const agents = manifest.policies.filter((policy) => policy.kind === 'agent');
  return agents.length > 0 ? agents : manifest.policies;
}

export function actionSpec(manifest: Manifest, actionId: number): ActionSpec | undefined {
  return manifest.actions.find((action) => action.id === actionId);
}

export function formatSetpoints(action: ActionSpec): string {
  return `${action.heating} / ${action.cooling} °C`;
}

/** Policies from `keys` that exist in the bundle and differ from the controller, in `keys` order. */
export function overlayPoliciesFor(manifest: Manifest, controllerKey: string, keys: readonly string[]): PolicySpec[] {
  return keys
    .filter((key) => key !== controllerKey)
    .map((key) => findPolicy(manifest, key))
    .filter((policy): policy is PolicySpec => policy !== undefined);
}

/** Relative change of `controller` against `reference` in percent (negative = less). */
export function relativeChangePct(controller: number, reference: number): number | null {
  return reference > 0 ? 100 * (controller / reference - 1) : null;
}
