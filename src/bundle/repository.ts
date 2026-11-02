import { z } from 'zod';
import { DecisionLog } from '../domain/decisionLog';
import { Trace } from '../domain/trace';
import { BundleError } from './errors';
import { bundleSummarySchema, type BundleSummary, type Manifest } from './manifest';
import { parseDecisions, parseManifest, parseTrace } from './parse';
import { fetchOptional, type Table, type TableReader } from './tableReader';

/** Read access to one exported simulation bundle. All methods cache their result. */
export interface Bundle {
  readonly id: string;
  readonly manifest: Manifest;
  trace(climate: string, policy: string): Promise<Trace>;
  /** Null when the bundle has no decision table for this policy (the agent explanation is then hidden). */
  decisions(climate: string, policy: string): Promise<DecisionLog | null>;
}

export interface BundleRepository {
  listBundles(): Promise<BundleSummary[]>;
  openBundle(id: string): Promise<Bundle>;
}

const INDEX_FILE = 'index.json';
const MANIFEST_FILE = 'manifest.json';

/** Bundles served as static files under `baseUrl/<bundle id>/`, listed in `baseUrl/index.json`. */
export class StaticBundleRepository implements BundleRepository {
  constructor(
    private readonly baseUrl: string,
    private readonly reader: TableReader,
  ) {}

  async listBundles(): Promise<BundleSummary[]> {
    const response = await fetchOptional(`${this.baseUrl}/${INDEX_FILE}`);
    if (response === null) {
      throw new BundleError('not found — import simulation results with tools/import_results.py', INDEX_FILE);
    }
    const result = z.array(bundleSummarySchema).safeParse(await response.json());
    if (!result.success) throw new BundleError(result.error.message, INDEX_FILE);
    return result.data;
  }

  async openBundle(id: string): Promise<Bundle> {
    const file = `${id}/${MANIFEST_FILE}`;
    const response = await fetchOptional(`${this.baseUrl}/${file}`);
    if (response === null) throw new BundleError('not found', file);
    const manifest = parseManifest(await response.json(), file);
    return new StaticBundle(id, manifest, `${this.baseUrl}/${id}`, this.reader);
  }
}

class StaticBundle implements Bundle {
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(
    readonly id: string,
    readonly manifest: Manifest,
    private readonly rootUrl: string,
    private readonly reader: TableReader,
  ) {}

  trace(climate: string, policy: string): Promise<Trace> {
    const file = `traces/${climate}/${policy}.parquet`;
    return this.memo(file, async () => {
      const rows = parseTrace(await this.readRequired(file), file);
      const { nominal_year, timesteps_per_hour, action_repeat } = this.manifest;
      return new Trace(rows, {
        nominalYear: nominal_year,
        timestepsPerHour: timesteps_per_hour,
        actionRepeat: action_repeat,
      });
    });
  }

  decisions(climate: string, policy: string): Promise<DecisionLog | null> {
    const file = `decisions/${climate}/${policy}.parquet`;
    return this.memo(file, async () => {
      const table = await this.reader.read(`${this.rootUrl}/${file}`);
      return table === null ? null : new DecisionLog(parseDecisions(table, this.manifest, file));
    });
  }


  private async readRequired(file: string): Promise<Table> {
    const table = await this.reader.read(`${this.rootUrl}/${file}`);
    if (table === null) throw new BundleError('not found', `${this.id}/${file}`);
    return table;
  }

  private memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key) as Promise<T> | undefined;
    if (cached !== undefined) return cached;
    const pending = load().catch((error: unknown) => {
      this.cache.delete(key); // allow a retry after a transient failure
      throw error;
    });
    this.cache.set(key, pending);
    return pending;
  }
}
