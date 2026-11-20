import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
if (!id || ['current','unfinished'].includes(id) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error('Uso: node scripts/freeze-ai.mjs nome-versione (current e unfinished sono riservati)');
const destination = resolve(root, 'scripts/ai-versions', id);
if (existsSync(destination)) throw new Error('Versione già esistente: non viene sovrascritta.');
const hash = value => createHash('sha256').update(value.toString().replace(/\r\n/g, '\n')).digest('hex');
const files = ['candidates', 'didactic', 'planner', 'search', 'tactics', 'position', 'opening-pace', 'types'];
if (existsSync(resolve(root, 'src/ai/coverage.ts'))) files.push('coverage');
const sources = files.map(name => [name, readFileSync(resolve(root, `src/ai/${name}.ts`), 'utf8')]);
const rules = Object.fromEntries(['game', 'geometry'].map(name => [name, hash(readFileSync(resolve(root, `src/engine/${name}.ts`)))]));
mkdirSync(destination, { recursive: true });
const manifest = { id, createdAt: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), rules, sources: {}, frozen: {} };
for (const [name, source] of sources) {
  // Rule engine stays shared; every AI dependency stays inside the snapshot.
  const frozen = source.replaceAll("'../engine/", "'../../../src/engine/")
    .replace(/^export \{ compareMove,.*from '\.\/analysis-search';\r?\n?/m, '');
  manifest.sources[name] = hash(source);
  manifest.frozen[name] = hash(frozen);
  writeFileSync(resolve(destination, `${name}.ts`), frozen);
}
writeFileSync(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.info(`AI congelata: ${id}`);
