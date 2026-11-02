// Static hosting can't list folders, so the app reads public/bundles/index.json, generated from each bundle's manifest.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const bundlesDir = join(import.meta.dirname, '..', 'public', 'bundles');

function readSummary(id) {
  const manifestPath = join(bundlesDir, id, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return { id, created_at: manifest.created_at ?? null };
  } catch (error) {
    console.warn(`[bundles] skipping ${id}: ${error.message}`);
    return null;
  }
}

const ids = existsSync(bundlesDir)
  ? readdirSync(bundlesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  : [];
const summaries = ids.map(readSummary).filter(Boolean);

if (summaries.length === 0) {
  console.warn('[bundles] no bundles found in public/bundles — import simulation results with tools/import_results.py');
} else {
  writeFileSync(join(bundlesDir, 'index.json'), JSON.stringify(summaries, null, 2));
  console.log(`[bundles] indexed: ${summaries.map((s) => s.id).join(', ')}`);
}
