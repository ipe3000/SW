import { ai2HardProfile, defaultHardProfile, defaultHardProfileId, defaultHardProfileName, p2HardProfile, type HardProfile } from '../ai/profile';
import { planningBudgets } from '../ai/planner';
import type { Side } from '../engine/game';
import { casesFor, defaults, initialGame, type Case } from './model';
import { simulateSummary, type MatchProgress, type MatchSummary } from './simulation';

export const weightLabels = { initiative: 'Iniziativa', reinforcements: 'Rinforzi', opening: 'Sviluppo d’apertura', danger: 'Rischio tattico', area: 'Opportunità ad area' };
export const weights = Object.keys(defaultHardProfile) as (keyof HardProfile)[];
type Profile = { id: string; values: HardProfile };
export type FixedField = { top: string; bottom: string } & (
  { strategy: 'p3' | 'tune' } | { strategy: 'profile'; profile: Profile; source: string }
);
export const referenceLabels = { [defaultHardProfileId]: `${defaultHardProfileName} · Difficile attuale`, p2: 'P2 · storico', ai2: 'AI #2 · storico' };
const referenceWeights = { [defaultHardProfileId]: defaultHardProfile, p2: p2HardProfile, ai2: ai2HardProfile };
export type SearchConfig = { seed: number; ranges: HardProfile; fixed?: FixedField; reference?: keyof typeof referenceLabels };
export const searchDefaults: SearchConfig = { seed: 301, ranges: { initiative: 20, reinforcements: 20, opening: 20, danger: 20, area: 20 } };
export const fixedFieldDefaults: FixedField = { top: 'F', bottom: 'C', strategy: 'p3' };
export const wallColumns = ['C', 'D', 'E', 'F', 'G', 'H'] as const;
const observedP3 = { id: 'P3', values: { initiative: 1.1287, reinforcements: 1.1201, opening: .8787, danger: .8402, area: 1.1628 } };
export const matchLimit = 150;
const fieldCounts = { screening: 6, shortlist: 6, validation: 12 };
export const maximumGames = 2 * (4 * fieldCounts.screening + 2 * fieldCounts.shortlist + fieldCounts.validation);
export const phaseLabels = { screening: 'Selezione iniziale', shortlist: 'Confronto finalisti', validation: 'Validazione' };
type Phase = keyof typeof phaseLabels;
type Job = { phase: Phase; profile: Profile; baseline: HardProfile; test: Case; candidateSide: Side; trace: boolean };
type ResultRow = MatchSummary & { id: string; phase: Phase; profile: string; seed: number; candidateSide: Side };
export type SearchRun = {
  format: 'strategic-wizardry-autotune';
  schema: 1;
  id: string;
  revision: number;
  build: string;
  created: string;
  runtime: string;
  config: SearchConfig;
  baseline: HardProfile;
  budget: typeof planningBudgets.hard;
  rules: { level: 'hard'; hp: 4; walls: 'standard'; placement: 'standard'; limit: number };
  profiles: Profile[];
  fields: Record<Phase, Case[]>;
  results: ResultRow[];
  failures: ResultRow[];
};

function randomSource(seed: number) {
  return () => {
    seed = (seed + 0x9e3779b9) >>> 0;
    let value = Math.imul(seed ^ seed >>> 16, 0x21f0aaad);
    value = Math.imul(value ^ value >>> 15, 0x735a2d97);
    return ((value ^ value >>> 15) >>> 0) / 4294967296;
  };
}

export function checkConfig(config: SearchConfig) {
  if (config.reference !== undefined && !Object.hasOwn(referenceWeights, config.reference)) throw new Error('Riferimento sconosciuto.');
  if (config.fixed && (!wallColumns.some(column => column === config.fixed?.top) || !wallColumns.some(column => column === config.fixed?.bottom) ||
      !['p3', 'tune', 'profile'].includes(config.fixed.strategy))) throw new Error('Scegli i due muri standard nelle colonne da C a H.');
  if (config.fixed?.strategy === 'profile') {
    const { profile } = config.fixed;
    if (!profile?.id || !weights.every(key => Number.isFinite(profile.values?.[key]) &&
        profile.values[key] >= .6 && profile.values[key] <= 1.4)) throw new Error('I pesi del profilo sono fuori intervallo.');
  }
  if (config.fixed && config.fixed.strategy !== 'tune') return;
  if (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff) throw new Error('Il seme deve essere un intero fra 0 e 4294967295.');
  if (!weights.every(key => Number.isInteger(config.ranges?.[key]) && config.ranges[key] >= 0 && config.ranges[key] <= 30) ||
      !weights.some(key => config.ranges[key] > 0)) throw new Error('Imposta variazioni intere da 0 a 30%, con almeno un peso sopra zero.');
}

export function gameBudget(config: SearchConfig) {
  return config.fixed ? config.fixed.strategy === 'tune' ? 8 : 2 : maximumGames;
}

export function verificationConfig(run: SearchRun, profile: Profile): SearchConfig {
  const { top, bottom } = run.config.fixed ?? fixedFieldDefaults;
  return { ...run.config, reference: run.config.reference ?? 'ai2', fixed: { top, bottom, strategy: 'profile', profile, source: run.id } };
}

function makeProfiles(config: SearchConfig, baseline: HardProfile): Profile[] {
  const random = randomSource(config.seed ^ 0x311eb9b3);
  const prefix = config.reference === 'ai2' ? 'P' : 'C';
  // Mirrored profiles cover both directions. The two distances give distinct profiles even if only one weight varies.
  return [0, 1].flatMap(pair => {
    const changes = weights.map(key => {
      const half = config.ranges[key] * 50;
      return (pair * half + Math.floor(random() * half)) * (random() < .5 ? -1 : 1);
    });
    if (!changes.some(Boolean)) changes[weights.findIndex(key => config.ranges[key] > 0)] = 1;
    return [1, -1].map((direction, index) => ({
      id: `${prefix}${pair * 2 + index + 1}`,
      values: Object.fromEntries(weights.map((key, axis) => [key,
        Math.round(baseline[key] * (10000 + direction * changes[axis])) / 10000])) as HardProfile,
    }));
  });
}

export function wallGroup(field: Case) {
  const [top, bottom] = [...initialGame(field).walls].sort((a, b) => a.y - b.y);
  const original = top.x * 10 + bottom.x;
  const rotated = (9 - bottom.x) * 10 + (9 - top.x);
  return Math.min(original, rotated);
}

export function createSearch(config: SearchConfig, build: string, runtime: string): SearchRun {
  checkConfig(config);
  const reference = config.reference ?? defaultHardProfileId;
  const baseline = referenceWeights[reference];
  const rules = { level: 'hard', hp: 4, walls: 'standard', placement: 'standard', limit: matchLimit } as const;
  const fields = casesFor({ ...defaults, mode: 'pair', a: rules.level, b: rules.level, hp: rules.hp, walls: rules.walls,
    limit: rules.limit, fields: 36, seed: config.fixed ? searchDefaults.seed : config.seed, audit: false });
  const start: Omit<SearchRun, 'profiles' | 'fields'> = {
    format: 'strategic-wizardry-autotune' as const, schema: 1 as const, id: crypto.randomUUID(), revision: 0, build,
    created: new Date().toISOString(), runtime, config: { ...config, reference, ranges: { ...config.ranges }, fixed: config.fixed && { ...config.fixed } },
    baseline, budget: { ...planningBudgets.hard }, rules,
    results: [], failures: [],
  };
  if (config.fixed) {
    const { top, bottom, strategy } = config.fixed;
    const field = fields.find(test => {
      const [first, second] = initialGame(test).walls;
      return wallColumns[first.x - 2] === top && wallColumns[second.x - 2] === bottom;
    });
    if (!field) throw new Error('Campo standard non trovato.');
    const profiles = config.fixed.strategy === 'profile' ? [config.fixed.profile]
      : strategy === 'p3' ? [observedP3] : makeProfiles(config, baseline);
    return { ...start, profiles,
      fields: { screening: [field], shortlist: [], validation: [] } };
  }
  const groups = new Map<number, Case[]>();
  for (const field of fields) {
    const key = wallGroup(field);
    const group = groups.get(key) ?? [];
    group.push(field);
    groups.set(key, group);
  }
  const orderedGroups = [...groups.values()];
  const validation = orderedGroups.slice(0, fieldCounts.validation).map(group => group[0]);
  const training = orderedGroups.slice(fieldCounts.validation);
  // At least three two-field groups remain among the nine development groups.
  const shortlistGroups = new Set(training.filter(group => group.length === 2).slice(0, fieldCounts.shortlist / 2));
  const screening = training.filter(group => !shortlistGroups.has(group)).map(group => group[0]);
  const shortlist = training.filter(group => shortlistGroups.has(group)).flat();
  return {
    ...start, profiles: makeProfiles(config, baseline),
    fields: { screening, shortlist, validation },
  };
}

function gameScore(row: ResultRow) {
  return row.outcome === row.candidateSide ? 1 : row.outcome === 'red' || row.outcome === 'blue' ? -1 : 0;
}

function completePairs(rows: ResultRow[]) {
  const byField = new Map<number, ResultRow[]>();
  for (const row of rows) {
    const pair = byField.get(row.seed) ?? [];
    pair.push(row);
    byField.set(row.seed, pair);
  }
  return [...byField.values()].filter(pair => pair.length === 2 && pair[0].candidateSide !== pair[1].candidateSide);
}

function scorePairs(pairs: ResultRow[][]) {
  const rows = pairs.flat();
  const wins = rows.filter(row => gameScore(row) === 1).length;
  const losses = rows.filter(row => gameScore(row) === -1).length;
  return { fields: pairs.length, wins, losses, limits: rows.filter(row => row.outcome === 'limit').length,
    repetitions: rows.filter(row => row.outcome === 'repetition').length, net: wins - losses };
}

export function rankings(run: SearchRun, phase?: Phase) {
  return run.profiles.map(profile => {
    const rows = run.results.filter(row => row.profile === profile.id && (phase ? row.phase === phase : row.phase !== 'validation'));
    return { profile, ...scorePairs(completePairs(rows)) };
  }).sort((a, b) => b.net - a.net || a.profile.id.localeCompare(b.profile.id));
}

function phaseJobs(run: SearchRun, phase: Phase, profiles: Profile[]): Job[] {
  return run.fields[phase].flatMap((field, index) => profiles.flatMap(profile => {
    const sides: Side[] = index % 2 === 0 ? ['red', 'blue'] : ['blue', 'red'];
    return sides.map(candidateSide => ({
      phase, profile, candidateSide, baseline: run.baseline, trace: Boolean(run.config.fixed) || phase === 'validation' && index === 0,
      test: { ...field, id: `${phase}-${profile.id}-${field.seed}-${candidateSide}`, reversed: candidateSide === 'blue' },
    }));
  }));
}

export function searchState(run: SearchRun) {
  const done = new Set(run.results.map(row => row.id));
  const screening = phaseJobs(run, 'screening', run.profiles).find(job => !done.has(job.test.id));
  if (screening) return { job: screening };
  if (run.config.fixed) return { verdict: 'field-complete' } as const;
  const leaders = rankings(run, 'screening').slice(0, 2).map(row => row.profile);
  const shortlist = phaseJobs(run, 'shortlist', leaders).find(job => !done.has(job.test.id));
  if (shortlist) return { job: shortlist };
  const eligible = new Set(leaders.map(profile => profile.id));
  const best = rankings(run).find(row => eligible.has(row.profile.id));
  if (!best || best.net <= 0) return { verdict: 'no-finalist' } as const;
  const finalist = best.profile;
  const validation = phaseJobs(run, 'validation', [finalist]).find(job => !done.has(job.test.id));
  if (validation) return { job: validation, finalist };
  const pairs = completePairs(run.results.filter(row => row.phase === 'validation'));
  const score = scorePairs(pairs);
  // One-sided exact sign test on field pairs, assigning every inconclusive game to the baseline.
  const worst = pairs.map(pair => pair.reduce((sum, row) => sum + (gameScore(row) || -1), 0));
  const positive = worst.filter(value => value > 0).length;
  const decisive = worst.filter(Boolean).length;
  let pValue = 0, combinations = 1;
  for (let k = 0; k <= decisive; k++) {
    if (k >= positive) pValue += combinations / 2 ** decisive;
    combinations *= (decisive - k) / (k + 1);
  }
  const verdict = score.net - score.limits - score.repetitions > 0 && pValue <= .05 ? 'validated' : 'inconclusive';
  return { finalist, score, pValue, verdict } as const;
}

export function playSearchJob(job: Job, onProgress?: (progress: MatchProgress) => void): MatchSummary {
  const profiles = job.candidateSide === 'red'
    ? { red: job.profile.values, blue: job.baseline }
    : { red: job.baseline, blue: job.profile.values };
  return simulateSummary(job.test, { limit: matchLimit, profiles, trace: job.trace, traceOnError: true, onProgress });
}

export function recordSearchGame(run: SearchRun, job: Job, summary: MatchSummary): SearchRun {
  const row = { ...summary, id: job.test.id, phase: job.phase, profile: job.profile.id, seed: job.test.seed, candidateSide: job.candidateSide };
  return summary.outcome === 'error'
    ? { ...run, revision: run.revision + 1, failures: [...run.failures, row] }
    : { ...run, revision: run.revision + 1, results: [...run.results, row] };
}

export function validatedProfile(run: SearchRun) {
  const state = searchState(run);
  if (state.verdict !== 'validated') return;
  return { format: 'strategic-wizardry-ai-profile', schema: 1, build: run.build, campaign: run.id,
    rules: run.rules, budget: run.budget, profile: state.finalist, validation: { ...state.score, pValue: state.pValue } };
}

export function searchReport(run: SearchRun) {
  const state = searchState(run);
  return { ...run, evaluation: state.verdict ?? 'in-progress', finalist: state.finalist?.id,
    fieldResults: run.config.fixed && rankings(run),
    validation: state.score && { ...state.score, pValue: state.pValue } };
}
