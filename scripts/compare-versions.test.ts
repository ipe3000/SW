import { it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chooseMove } from '../src/ai/search';
import { newMatch, defaultOptions, type ComputerDifficulty } from '../src/engine/game';
import { runVersionMatch, type VersionPlayer } from './version-match';

it('confronta versioni congelate a colori invertiti, in sequenza', async () => {
  const versionA = process.env.SW_AI_A ?? 'before-tactical-20261120';
  const versionB = process.env.SW_AI_B ?? 'current';
  const hash = (value: string | Buffer) => createHash('sha256').update(value.toString().replace(/\r\n/g, '\n')).digest('hex');
  const snapshots: Record<string, unknown> = {};
  async function load(id: string): Promise<VersionPlayer> {
    if (id === 'current') return { id, choose: chooseMove };
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error('Identificativo versione non valido.');
    const path = resolve('scripts/ai-versions', id), manifest = JSON.parse(readFileSync(resolve(path, 'manifest.json'), 'utf8'));
    snapshots[id] = manifest;
    for (const [name, checksum] of Object.entries(manifest.rules)) {
      if (hash(readFileSync(`src/engine/${name}.ts`)) !== checksum) throw new Error('Regole diverse: confronto AI non compatibile.');
    }
    for (const [name, checksum] of Object.entries(manifest.frozen)) {
      if (hash(readFileSync(resolve(path, `${name}.ts`))) !== checksum) throw new Error(`Snapshot alterato: ${name}`);
    }
    return { id, choose: (await import(`./ai-versions/${id}/search.ts`)).chooseMove };
  }
  if (versionA === versionB) throw new Error('Scegli due versioni diverse.');
  const a = await load(versionA), b = await load(versionB);
  const levels = (process.env.SW_AI_LEVELS ?? 'normal,hard').split(',') as ComputerDifficulty[];
  if (levels.some(level => !['easy', 'normal', 'hard'].includes(level))) throw new Error('Livello non valido.');
  const seeds = (process.env.SW_AI_SEEDS ?? '301,502').split(',').map(Number);
  const health = (process.env.SW_AI_HP ?? '3').split(',').map(Number) as (3|4|5)[];
  const walls = (process.env.SW_AI_WALLS ?? 'standard').split(',') as ('standard'|'varied')[];
  if (health.some(hp => ![3,4,5].includes(hp)) || walls.some(wall => !['standard','varied'].includes(wall))) throw new Error('Regole non valide.');
  const repetitions = Number(process.env.SW_AI_REPEATS ?? 1), limit = Number(process.env.SW_AI_MAX_COMMANDS ?? 150);
  if (seeds.some(n => !Number.isSafeInteger(n)) || !Number.isSafeInteger(repetitions) || repetitions < 1 || !Number.isSafeInteger(limit) || limit < 1) throw new Error('Configurazione non valida.');
  const directory = `output/ai-versions/${Date.now()}`; mkdirSync(directory, { recursive: true });
  const metadata = { versionA, versionB, snapshots, sourceHashes: Object.fromEntries(['candidates','didactic','planner','search','tactics','position','opening-pace','types','coverage'].map(name => [name, hash(readFileSync(`src/ai/${name}.ts`))])), levels, seeds, health, walls, repetitions, limit };
  const rows: unknown[] = [];
  for (const level of levels) for (const seed of seeds) for (const hp of health) for (const wall of walls) for (let repeat = 0; repeat < repetitions; repeat++) for (const swapped of [false, true]) {
    let state = seed;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const game = newMatch({ ...defaultOptions, hp, walls: wall }, random).game;
    game.id = `versions-${seed}-${hp}-${wall}-${repeat}`;
    const result = runVersionMatch(game, swapped ? b : a, swapped ? a : b, level, limit);
    const timing = Object.fromEntries([a.id,b.id].map(id => {
      const durations = result.steps.filter(step => step.version === id).map(step => step.milliseconds).sort((x,y) => x-y);
      return [id, { decisions: durations.length, totalMs: durations.reduce((sum,n) => sum+n,0), p95Ms: durations[Math.max(0,Math.ceil(durations.length*.95)-1)] ?? null }];
    }));
    const name = `${level}-${seed}-${hp}-${wall}-${repeat}-${Number(swapped)}.json`;
    writeFileSync(`${directory}/${name}`, JSON.stringify(result));
    rows.push({ level, seed, hp, walls: wall, repeat, swapped, outcome: result.outcome, commands: result.steps.length, timing, file: name });
    writeFileSync(`${directory}/results.json`, JSON.stringify({ metadata, rows }, null, 2));
    console.info(rows.at(-1));
  }
}, 86_400_000);
