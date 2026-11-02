import { parquetMetadata, parquetReadObjects, parquetSchema } from 'hyparquet';

export type RawRow = Record<string, unknown>;

export interface Table {
  columns: string[];
  rows: RawRow[];
}

/** Reads one table file. Resolves to null when the file does not exist. */
export interface TableReader {
  read(url: string): Promise<Table | null>;
}

export async function fetchOptional(url: string): Promise<Response | null> {
  const response = await fetch(url);
  // Dev servers answer unknown paths with the SPA's index.html instead of a 404.
  const isHtmlFallback = response.headers.get('content-type')?.includes('text/html') ?? false;
  if (response.status === 404 || isHtmlFallback) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response;
}

export class ParquetTableReader implements TableReader {
  async read(url: string): Promise<Table | null> {
    const response = await fetchOptional(url);
    if (response === null) return null;
    const buffer = await response.arrayBuffer();
    const metadata = parquetMetadata(buffer);
    const columns = parquetSchema(metadata).children.map((child) => child.element.name);
    const rows = await parquetReadObjects({ file: buffer, metadata });
    return { columns, rows: rows.map(normalizeRow) };
  }
}

function normalizeRow(row: Record<string, unknown>): RawRow {
  const normalized: RawRow = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = typeof value === 'bigint' ? Number(value) : (value ?? null);
  }
  return normalized;
}
