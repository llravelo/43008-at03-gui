# Cadence dashboard

Operations dashboard for the Cadence HVAC agents (DQN, DDQN and PPO on the Sinergym 5Zone building). It replays one
recorded simulation year as a live building feed and compares the selected agent with three baselines (fixed setpoint,
random, rule-based). It is a static site: the browser reads the bundle's Parquet files directly, with no backend.

## Run

```bash
npm install
npm run dev       # http://localhost:5173 (re-indexes public/bundles first)
npm run build     # static site in dist/, including public/bundles
npm run preview   # serves dist/ locally
```

`dist/` can be served by any static host; asset and data paths are relative (`base: './'` in `vite.config.ts`).
Every push to `main` builds and deploys the site to GitHub Pages (`.github/workflows/deploy.yml`).

## Data

The dashboard reads **bundles** from `public/bundles/<bundle_id>/`:

```
manifest.json                          constants, actions, climates, policies, training configs
traces/{climate}/{policy}.parquet      15-minute simulation steps (35,040 rows)
decisions/{climate}/{policy}.parquet   hourly decisions with per-action scores for the agents (8,760 rows)
metrics.parquet                        evaluation metrics per policy and climate
training/{algo}.parquet                per-year training log
```

`public/bundles/index.json` lists the bundles; `npm run dev` and `npm run build` regenerate it.

### Importing simulation results

`tools/import_results.py` converts a results folder of the training notebook (`cadence_hvac_dqn_ddqn_ppo.ipynb`) into a
bundle. Needs [uv](https://docs.astral.sh/uv/); EnergyPlus is not needed.

```bash
uv run tools/import_results.py path/to/results/cadence_v3     # -> public/bundles/cadence_v3
```

The notebook logs the 15-minute records but not the agents' per-action scores. The script rebuilds each decision's
observation from the logged records and replays it through the saved model (`final_model.zip` + `vecnormalize.pkl`)
to get Q-values (DQN, DDQN) or action probabilities (PPO). Before writing, it checks that the reward terms add up to
the logged reward, that the metrics match `evaluation_metrics.csv`, and that the rebuilt Q-values match the notebook's
`q_estimates_*` files; after writing, `tools/cadence_bundle.py` validates the bundle, including that every agent's logged
action is its highest-scoring one.

### Notes on the data

* **Timestamps are the end of each 15-minute step**, as Sinergym logs them. The agent decides on the hour, so a setpoint
  chosen at 07:00 first appears in the 07:15 record.
* **Decisions 0 and 1 (1 Jan, 00:00–01:00) have no scores.** They depend on the simulation's reset observation, which
  the notebook does not log.

## Architecture

```
public/bundles/<id>/      static data (contract: tools/cadence_bundle.py ⇄ src/bundle/columns.ts)
tools/                    import_results.py (results → bundle), cadence_bundle.py (contract + validation)
src/bundle/               the only code that knows about files
  manifest.ts             zod schema → Manifest type
  columns.ts              table contract and row types
  tableReader.ts          TableReader interface + ParquetTableReader (hyparquet)
  parse.ts                tables → typed rows, with column checks
  repository.ts           BundleRepository / Bundle interfaces + static-file implementation (cached)
src/domain/               pure logic, no React: Trace (range totals), events, period totals, policies
src/charts/               ECharts wrapper + option builders (pure functions)
src/state/                app state reducer, bundle context
src/hooks/                async data hooks, playback
src/pages/operations/     the Operations page
src/config.ts             comparison/overlay baselines, playback speeds, chart windows, initial cursor
src/main.tsx              composition root (picks the repository and reader implementations)
```

Dependencies point downwards only: pages → hooks/state → bundle → domain. Components receive domain objects and never fetch.

### Extension points

| To add… | Change |
|---|---|
| A KPI card (e.g. optional perimeter zone temperatures, which arrive in `TraceRow.extra`) | Add a descriptor in `src/pages/operations/kpis.ts` |
| A controller | Nothing: every bundle policy with `kind: "agent"` is offered as a controller; baselines appear only in `APP_CONFIG.comparisonPolicies` and `overlayPolicies` |
| An event type in the log | Add an `EventDetector` to `DEFAULT_EVENT_DETECTORS` in `src/domain/events.ts` |
| Another file format or data source | Implement `TableReader` or `BundleRepository` and wire it in `src/main.tsx` |
| A contract column | Add it to `tools/cadence_bundle.py` **and** `src/bundle/columns.ts`; extra trace columns already pass through as `extra` |
