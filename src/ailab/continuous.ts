import { defaultHardProfile, defaultHardProfileName, p2HardProfile, type HardProfile } from '../ai/profile';
import { profileWeightCeiling, profileWeightFloor, type LocalHardProfile } from '../ai/local-profile';
import type { Side } from '../engine/game';
import { createSearch, fixedFieldDefaults, searchDefaults, wallColumns, weights } from './autotune';
import type { SearchWorkerJob } from './autotune-worker';
import type { Case } from './model';
import type { MatchSummary } from './simulation';

type Profile = SearchWorkerJob['profile'];
type Stage = 'screening' | 'shortlist' | 'validation';
export const continuousStages = { screening: 'Esplorazione', shortlist: 'Conferma a colori invertiti', validation: 'Controllo contro il profilo iniziale' };
export const continuousStops = { rounds: 'Limite di giri raggiunto', time: 'Budget di simulazione esaurito', plateau: 'Nessun progresso nei giri consentiti' };
export type ContinuousSettings = { top: string; bottom: string; seed: number; radius: number };
export type SessionLimits = { rounds: number; minutes: number; stagnant: number; unlimited?: boolean };
export const continuousDefaults: ContinuousSettings = { top: fixedFieldDefaults.top, bottom: fixedFieldDefaults.bottom, seed: 503, radius: 12 };
export const sessionDefaults: SessionLimits = { rounds: 3, minutes: 120, stagnant: 3 };
const legacyAnchor: Profile = { id: 'P2', values: p2HardProfile };
const publishedAnchor: Profile = { id: defaultHardProfileName, values: defaultHardProfile };

type GameRow = { id: string; stage: Stage; candidate: string; side: Side; outcome: MatchSummary['outcome']; elapsed: number;
  commands: number; stats: MatchSummary['stats'] };
type Round = { number: number; candidates: Profile[]; rows: GameRow[] };
type RoundRecord = { number: number; reference: Profile; candidates: Profile[]; rows: GameRow[]; winner?: Profile };
export type ContinuousRun = {
  format: 'strategic-wizardry-autotune-continuous';
  schema: 1;
  id: string;
  revision: number;
  build: string;
  runtime: string;
  created: string;
  settings: ContinuousSettings;
  field: Case;
  budget: ReturnType<typeof createSearch>['budget'];
  rules: ReturnType<typeof createSearch>['rules'];
  champion: Profile;
  anchor?: Profile;
  games: number;
  elapsed: number;
  rounds: number;
  promotions: number;
  lastPromotionRound: number;
  round?: Round;
  history: RoundRecord[];
  championEvidence?: RoundRecord;
  failures: number;
  lastError?: { job: string; message: string };
  session: { limits: SessionLimits; atRound: number; atElapsed: number };
};

function integer(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function checkLimits(limits: SessionLimits) {
  if (!integer(limits.rounds, 1, 100) || !integer(limits.minutes, 1, 1440) || !integer(limits.stagnant, 1, 100)) {
    throw new Error('Usa 1–100 giri, 1–1.440 minuti e 1–100 giri senza promozioni.');
  }
}

export function startContinuous(settings: ContinuousSettings, limits: SessionLimits, build: string, runtime: string): ContinuousRun {
  checkLimits(limits);
  if (!integer(settings.seed, 0, 0xffffffff) || !integer(settings.radius, 2, 30)) throw new Error('Usa un seme intero fra 0 e 4294967295 e variazioni dal 2 al 30%.');
  if (!wallColumns.some(column => column === settings.top) || !wallColumns.some(column => column === settings.bottom)) throw new Error('Scegli i due muri standard.');
  const initial = createSearch({ ...searchDefaults, fixed: { top: settings.top, bottom: settings.bottom, strategy: 'p3' } }, build, runtime);
  return {
    format: 'strategic-wizardry-autotune-continuous', schema: 1, revision: 0, id: initial.id, created: initial.created, build, runtime,
    settings: { ...settings }, field: initial.fields.screening[0], budget: initial.budget, rules: initial.rules,
    anchor: publishedAnchor, champion: publishedAnchor, games: 0, elapsed: 0, rounds: 0, promotions: 0, lastPromotionRound: 0,
    history: [], failures: 0, session: { limits: { ...limits }, atRound: 0, atElapsed: 0 },
  };
}

export function extendContinuous(run: ContinuousRun, limits: SessionLimits): ContinuousRun {
  checkLimits(limits);
  return { ...run, revision: run.revision + 1, session: { limits: { ...limits }, atRound: run.rounds, atElapsed: run.elapsed } };
}

export function continuousProfile(run: ContinuousRun) {
  if (!run.championEvidence) return;
  const { top, bottom } = run.settings;
  const profile: LocalHardProfile = { ...run.champion, source: run.id, field: { top, bottom } };
  return { ...profile, build: run.build, evidence: run.championEvidence };
}

export function continuousStop(run: ContinuousRun): keyof typeof continuousStops | undefined {
  const { atRound, atElapsed, limits } = run.session;
  if (limits.unlimited) return;
  if (run.elapsed - atElapsed >= limits.minutes * 60_000) return 'time';
  if (run.rounds - atRound >= limits.rounds) return 'rounds';
  if (run.rounds - Math.max(atRound, run.lastPromotionRound) >= limits.stagnant) return 'plateau';
}

function profileKey(profile: Profile) {
  return weights.map(key => profile.values[key]).join(',');
}

function makeRound(run: ContinuousRun): Round {
  const anchor = run.anchor ?? legacyAnchor;
  const number = run.rounds + 1;
  const stale = run.rounds - run.lastPromotionRound;
  // Alternate the size after stalls. Every round probes one weight and also interactions between weights.
  const scale = [1, .5, 1.5][stale % 3];
  let seed = (run.settings.seed ^ Math.imul(number, 0x9e3779b9)) >>> 0;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const tested = new Set([profileKey(run.champion), profileKey(anchor)]);
  for (const previous of run.history) {
    if (previous.reference.id === run.champion.id) previous.candidates.forEach(candidate => tested.add(profileKey(candidate)));
  }
  const candidates: Profile[] = [];
  const add = (values: HardProfile) => {
    const candidate = { id: `G${number}-C${candidates.length + 1}`, values };
    const key = profileKey(candidate);
    if (!tested.has(key)) { tested.add(key); candidates.push(candidate); }
  };
  for (let attempt = 0; attempt < 64 && candidates.length < 4; attempt++) {
    const axis = weights[(number - 1 + Math.floor(attempt / 2)) % weights.length];
    const maximum = Math.min(.30, run.settings.radius / 100 * scale);
    const varied = Object.fromEntries(weights.map(key => {
      const amount = maximum * (.30 + random() * .70);
      const sign = attempt < 2 ? (attempt === 0 ? 1 : -1) : random() < .5 ? 1 : -1;
      const base = run.champion.values[key];
      const next = attempt < 2 && key !== axis ? base : base * (1 + sign * amount);
      return [key, Math.round(Math.min(profileWeightCeiling, Math.max(profileWeightFloor, next)) * 10_000) / 10_000];
    })) as HardProfile;
    add(varied);
  }
  // At a weight boundary several perturbations can round to an already-tested point.
  for (let delta = 1; delta <= 50 && candidates.length < 4; delta++) {
    for (const key of weights) {
      if (candidates.length >= 4) break;
      const direction = run.champion.values[key] < 1 ? 1 : -1;
      const value = (Math.round(run.champion.values[key] * 10_000) + direction * delta) / 10_000;
      add({ ...run.champion.values, [key]: value });
    }
  }
  if (!candidates.length) throw new Error('Impossibile generare nuovi profili entro i limiti dei pesi.');
  return { number, candidates, rows: [] };
}

function roundState(run: ContinuousRun, round: Round): { job?: SearchWorkerJob; winner?: Profile } {
  const anchor = run.anchor ?? legacyAnchor;
  function pair(candidate: Profile, phase: Stage, baseline: Profile, first: Side) {
    const second = first === 'red' ? 'blue' : 'red';
    const sides: Side[] = [first, second];
    return sides.map((side): SearchWorkerJob => ({
      phase, profile: candidate, baseline: baseline.values, candidateSide: side, trace: false,
      test: { ...run.field, id: `${run.id}-${candidate.id}-${phase}-${side}`, reversed: side === 'blue' },
    }));
  }
  function next(jobs: SearchWorkerJob[]) {
    return jobs.find(job => !round.rows.some(row => row.id === job.test.id));
  }
  function wins(jobs: SearchWorkerJob[]) {
    return jobs.filter(job => round.rows.find(row => row.id === job.test.id)?.outcome === job.candidateSide).length;
  }
  const first = round.number % 2 ? 'red' : 'blue';
  const other = first === 'red' ? 'blue' : 'red';
  for (const candidate of round.candidates) {
    const job = next(pair(candidate, 'screening', run.champion, first));
    if (job) return { job };
  }
  for (const candidate of round.candidates) {
    if (wins(pair(candidate, 'screening', run.champion, first)) !== 2) continue;
    const confirm = pair(candidate, 'shortlist', run.champion, other), confirmation = next(confirm);
    if (confirmation) return { job: confirmation };
    if (wins(confirm) !== 2) continue;
    if (run.champion.id !== anchor.id) {
      const guard = pair(candidate, 'validation', anchor, first), regression = next(guard);
      if (regression) return { job: regression };
      const decided = guard.every(item => {
        const outcome = round.rows.find(row => row.id === item.test.id)?.outcome;
        return outcome === 'red' || outcome === 'blue';
      });
      if (!decided || wins(guard) < 1) continue;
    }
    return { winner: candidate };
  }
  return {};
}

export function continuousState(run: ContinuousRun) {
  const stop = continuousStop(run);
  const round = run.round ?? (stop ? undefined : makeRound(run));
  const job = !stop && round ? roundState(run, round).job : undefined;
  return { stop, round, job };
}

export function recordContinuousGame(run: ContinuousRun, job: SearchWorkerJob, summary: MatchSummary): ContinuousRun {
  const state = continuousState(run);
  if (!state.round || state.job?.test.id !== job.test.id) throw new Error('Risultato fuori sequenza.');
  const updated = { ...run, revision: run.revision + 1, elapsed: run.elapsed + summary.elapsed, round: state.round };
  if (summary.outcome === 'error') {
    return { ...updated, failures: run.failures + 1, lastError: { job: job.test.id, message: summary.error ?? 'Errore di simulazione.' } };
  }
  const row = { id: job.test.id, stage: job.phase, candidate: job.profile.id, side: job.candidateSide, outcome: summary.outcome,
    elapsed: summary.elapsed, commands: summary.commands, stats: summary.stats };
  const round = { ...state.round, rows: [...state.round.rows, row] };
  const played = { ...updated, games: run.games + 1 };
  const { job: next, winner } = roundState(run, round);
  if (next) return { ...played, round };
  const record = { ...round, reference: run.champion, winner };
  return {
    ...played, round: undefined, rounds: round.number, history: [...run.history.slice(-29), record],
    champion: winner ?? run.champion, championEvidence: winner ? record : run.championEvidence,
    promotions: run.promotions + Number(Boolean(winner)), lastPromotionRound: winner ? round.number : run.lastPromotionRound,
  };
}
