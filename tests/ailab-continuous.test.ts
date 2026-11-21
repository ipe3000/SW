import { afterEach, expect, it, vi } from 'vitest';
import { defaultHardProfile, defaultHardProfileName, p2HardProfile } from '../src/ai/profile';
import { localHardWeights, saveLocalHardProfile } from '../src/ai/local-profile';
import { initialGame } from '../src/ailab/model';
import { continuousDefaults, continuousProfile, continuousState, extendContinuous, recordContinuousGame, sessionDefaults, startContinuous, type ContinuousRun } from '../src/ailab/continuous';
import type { MatchSummary } from '../src/ailab/simulation';

const stats = { decisions: 0, milliseconds: 0, maxMs: 0, evaluated: 0, timedOut: 0, nodesExhausted: 0, fallbacks: 0 };
const sample = (outcome: MatchSummary['outcome'], elapsed = 1): MatchSummary =>
  ({ outcome, elapsed, commands: 0, stats: { red: stats, blue: stats } });
const start = () => startContinuous(continuousDefaults, sessionDefaults, 'test-build', 'tests');

afterEach(() => vi.unstubAllGlobals());

function finishRound(run: ContinuousRun, outcome: (job: NonNullable<ReturnType<typeof continuousState>['job']>) => MatchSummary['outcome']) {
  const rounds = run.rounds;
  for (let i = 0; i < 24; i++) {
    const job = continuousState(run).job!;
    run = recordContinuousGame(run, job, sample(outcome(job)));
    if (run.rounds > rounds) return run;
  }
  throw new Error('Round did not end');
}

it('preserves the pair across a serialized checkpoint and switches the first color at confirmation', () => {
  let run = start();
  const job = continuousState(run).job!;
  expect(initialGame(job.test).walls).toEqual([{ x: 5, y: 4 }, { x: 2, y: 5 }]);
  expect(initialGame(job.test).options).toMatchObject({ hp: 4, walls: 'standard', placement: 'standard' });
  expect(job.baseline).toEqual(defaultHardProfile);
  run = recordContinuousGame(run, job, sample(job.candidateSide));
  const next = continuousState(JSON.parse(JSON.stringify(run))).job!;
  expect(next.candidateSide).toBe('blue');
  expect(next.profile).toEqual(job.profile);
  expect(initialGame(next.test)).toEqual(initialGame(job.test));
  for (let i = 1; i < 8; i++) {
    const job = continuousState(run).job!;
    run = recordContinuousGame(run, job, sample(job.profile.id === 'G1-C1' ? job.candidateSide : 'red'));
  }
  const confirm = continuousState(run).job!;
  expect(confirm.phase).toBe('shortlist');
  expect(confirm.candidateSide).toBe('blue');
  expect(run.champion.id).toBe(defaultHardProfileName);
});

it('promotes only after two sweeps, recenters the candidates and checks against its starting profile', () => {
  let run = finishRound(start(), job => job.profile.id === 'G1-C1' ? job.candidateSide : 'red');
  expect(run.games).toBe(10);
  expect(run.champion.id).toBe('G1-C1');
  expect(continuousProfile(run)).toMatchObject({ id: 'G1-C1', field: { top: 'F', bottom: 'C' }, evidence: { number: 1 } });
  expect(continuousState(run).job?.baseline).toEqual(run.champion.values);
  run = finishRound(run, job => job.profile.id === 'G2-C1'
    ? job.phase === 'validation' ? (job.candidateSide === 'red' ? 'blue' : 'red') : job.candidateSide
    : 'red');
  expect(run.history[1].rows.filter(row => row.stage === 'validation')).toHaveLength(2);
  expect(run.champion.id).toBe('G1-C1');
  run = finishRound(run, job => job.phase === 'validation' ? 'red' : job.profile.id === 'G3-C1' ? job.candidateSide : 'red');
  expect(run.champion.id).toBe('G3-C1');
  expect(run.promotions).toBe(2);
  expect(continuousState(run).stop).toBe('rounds');
});

it('rejects a split confirmation and continues from the same champion after a plateau', () => {
  const limits = { ...sessionDefaults, stagnant: 1 };
  const base = startContinuous(continuousDefaults, limits, 'test-build', 'tests');
  const run = finishRound(base, job => job.profile.id === 'G1-C1' && job.phase === 'screening' ? job.candidateSide : 'red');
  expect(run.games).toBe(10);
  expect(run.champion.id).toBe(defaultHardProfileName);
  expect(continuousState(run).stop).toBe('plateau');
  expect(continuousState({ ...run, session: { ...run.session, limits: { ...limits, unlimited: true } } }).job).toBeDefined();
  const extended = extendContinuous(run, limits);
  expect(continuousState(extended).job?.profile.id).toBe('G2-C1');
});

it('keeps the P2 check for a checkpoint that predates the anchor field', () => {
  let run = { ...start(), anchor: undefined, champion: { id: 'P2', values: p2HardProfile } };
  const promoted = finishRound(run, job => job.profile.id === 'G1-C1' ? job.candidateSide : 'red');
  expect(promoted.history[0].rows.some(row => row.stage === 'validation')).toBe(false);
});

it('keeps a failed match pending, enforces the time budget and resumes the same pair', () => {
  const run = startContinuous(continuousDefaults, { ...sessionDefaults, minutes: 1 }, 'test-build', 'tests');
  const job = continuousState(run).job!;
  const failed = recordContinuousGame(run, job, sample('error', 10));
  expect(failed.games).toBe(0);
  expect(failed.failures).toBe(1);
  expect(continuousState(failed).job).toEqual(job);
  const stopped = recordContinuousGame(failed, job, sample('red', 60_000));
  expect(continuousState(stopped)).toMatchObject({ stop: 'time', job: undefined });
  const resumed = continuousState(extendContinuous(stopped, sessionDefaults)).job!;
  expect(resumed.candidateSide).toBe('blue');
  expect(resumed.profile).toEqual(job.profile);
  expect(() => recordContinuousGame(stopped, job, sample('red'))).toThrow('fuori sequenza');
});

it('applies a promoted profile only on its exact field and Hard in the local game', () => {
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key) });
  const base = start();
  const run = finishRound(base, job => job.profile.id === 'G1-C1' ? job.candidateSide : 'red');
  const profile = continuousProfile(run)!;
  saveLocalHardProfile(profile);
  const game = initialGame(base.field);
  expect(localHardWeights(game, 'hard')).toEqual(profile.values);
  expect(localHardWeights(game, 'normal')).toBeUndefined();
  expect(localHardWeights({ ...game, walls: [{ x: 4, y: 4 }, { x: 2, y: 5 }] }, 'hard')).toBeUndefined();
  expect(localHardWeights({ ...game, options: { ...game.options, hp: 3 } }, 'hard')).toBeUndefined();
  saveLocalHardProfile();
  expect(localHardWeights(game, 'hard')).toBeUndefined();
});
