import { z } from 'zod';

export const SUPPORTED_SCHEMA_VERSION = 1;

const range = z.tuple([z.number(), z.number()]);
const monthDay = z.tuple([z.number().int(), z.number().int()]);

const actionSchema = z.object({
  id: z.number().int(),
  heating: z.number(),
  cooling: z.number(),
});

const climateSchema = z.object({
  key: z.string(),
  label: z.string(),
  env_id: z.string(),
});

const policySchema = z.object({
  key: z.string(),
  name: z.string(),
  kind: z.enum(['agent', 'baseline']),
  score_type: z.enum(['q_value', 'probability']).nullable(),
  color: z.string(),
});

const algorithmSchema = z.object({
  config: z.record(z.unknown()),
  train_time_sec: z.number(),
  timesteps: z.number(),
});

export const manifestSchema = z.object({
  schema_version: z.literal(SUPPORTED_SCHEMA_VERSION),
  bundle_id: z.string(),
  created_at: z.string(),
  nominal_year: z.number().int(),
  timesteps_per_hour: z.number().int().positive(),
  action_repeat: z.number().int().positive(),
  operating_hours: range,
  workdays_eplus: z.array(z.number().int()),
  comfort: z.object({ winter: range, summer: range, summer_start: monthDay, summer_end: monthDay }),
  reward: z.record(z.number()),
  actions: z.array(actionSchema).nonempty(),
  train_climate: z.string(),
  climates: z.array(climateSchema).nonempty(),
  policies: z.array(policySchema).nonempty(),
  algorithms: z.record(algorithmSchema),
  feature_names: z.array(z.string()),
  metric_labels: z.record(z.string()),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type ActionSpec = z.infer<typeof actionSchema>;
export type PolicySpec = z.infer<typeof policySchema>;
export type ScoreType = NonNullable<PolicySpec['score_type']>;

export const bundleSummarySchema = z.object({
  id: z.string(),
  created_at: z.string().nullable(),
});

export type BundleSummary = z.infer<typeof bundleSummarySchema>;
