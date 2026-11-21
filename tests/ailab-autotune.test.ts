import { expect, it } from 'vitest';
import { createSearch, fixedFieldDefaults, gameBudget, maximumGames, rankings, recordSearchGame, searchDefaults, searchReport, searchState, validatedProfile, wallGroup } from '../src/ailab/autotune';
import { initialGame } from '../src/ailab/model';
import { simulateSummary, type MatchSummary } from '../src/ailab/simulation';
import { applyComputerCommand } from '../src/ai/types';
import { ai2HardProfile, defaultHardProfile, defaultHardProfileId, p2HardProfile } from '../src/ai/profile';

const sideStats = { decisions: 0, milliseconds: 0, maxMs: 0, evaluated: 0, timedOut: 0, nodesExhausted: 0, fallbacks: 0 };
const sample = (outcome: MatchSummary['outcome']): MatchSummary => ({
  outcome, elapsed: 10, commands: 0, stats: { red: sideStats, blue: sideStats },
});

it.each(['p3', 'tune'] as const)('keeps both colors on exactly F6–C5 in single-field mode %s', strategy => {
  const config = { ...searchDefaults, fixed: { ...fixedFieldDefaults, strategy } };
  let run = createSearch(config, 'build', 'test');
  expect(gameBudget(config)).toBe(strategy === 'p3' ? 2 : 8);
  expect(run.fields.validation).toEqual([]);
  for (let i = 0; i < gameBudget(config); i++) {
    const job = searchState(run).job!;
    expect(initialGame(job.test).walls).toEqual([{ x: 5, y: 4 }, { x: 2, y: 5 }]);
    expect(job.candidateSide).toBe(i % 2 === 0 ? 'red' : 'blue');
    run = recordSearchGame(run, job, sample(job.candidateSide));
  }
  expect(searchState(run).verdict).toBe('field-complete');
  expect(validatedProfile(run)).toBeUndefined();
  expect(searchReport(run).fieldResults?.every(row => row.fields === 1 && row.wins === 2)).toBe(true);
});

it('partitions standard hard fields before tuning, including rotations, with repeatable and distinct profiles', () => {
  for (const seed of [0, 1, 301, 502, 0xffffffff]) {
    const config = { seed, reference: 'ai2' as const, ranges: { initiative: 1, reinforcements: 0, opening: 0, danger: 0, area: 0 } };
    const run = createSearch(config, 'build', 'test');
    expect(run.profiles).toEqual(createSearch(config, 'build', 'test').profiles);
    expect(new Set(run.profiles.map(profile => profile.values.initiative)).size).toBe(4);
    expect(run.profiles.every(profile => Math.abs(profile.values.initiative - 1) < .01)).toBe(true);
    const phases = Object.values(run.fields);
    expect(phases.map(fields => fields.length)).toEqual([6, 6, 12]);
    expect(new Set(phases.flat().map(field => field.fieldKey)).size).toBe(24);
    for (let i = 0; i < phases.length; i++) {
      const groups = new Set(phases[i].map(wallGroup));
      expect(phases.slice(i + 1).flat().some(field => groups.has(wallGroup(field)))).toBe(false);
      for (const field of phases[i]) {
        expect([field.red, field.blue]).toEqual(['hard', 'hard']);
        const game = initialGame(field);
        expect(game.options).toMatchObject({ hp: 4, walls: 'standard', placement: 'standard' });
        expect(game.walls).toHaveLength(2);
        expect(game.active).toBe('red');
      }
    }
  }
});

it('generates new candidates around the selected reference and includes its weights in both jobs', () => {
  const config = { ...searchDefaults, seed: 502, fixed: { ...fixedFieldDefaults, strategy: 'tune' as const },
    ranges: { ...searchDefaults.ranges, danger: 0 } };
  for (const [reference, baseline] of [[defaultHardProfileId, defaultHardProfile], ['p2', p2HardProfile], ['ai2', ai2HardProfile]] as const) {
    const run = createSearch({ ...config, reference }, 'build', 'test');
    expect(run.baseline).toEqual(baseline);
    expect(run.profiles.every(profile => profile.values.danger === baseline.danger)).toBe(true);
    const first = searchState(run).job!;
    const next = searchState(recordSearchGame(run, first, sample('red'))).job!;
    expect([first.candidateSide, next.candidateSide]).toEqual(['red', 'blue']);
    expect(first.baseline).toEqual(baseline);
    expect(next.baseline).toEqual(baseline);
  }
  expect(createSearch(config, 'build', 'test').config.reference).toBe(defaultHardProfileId);
});

it('resumes a failed encounter and scores only completed color pairs', () => {
  let run = createSearch(searchDefaults, 'build', 'test');
  const { job } = searchState(run);
  run = recordSearchGame(run, job!, sample('error'));
  run = JSON.parse(JSON.stringify(run));
  expect(searchState(run).job).toEqual(job);
  expect(run.failures).toHaveLength(1);
  run = recordSearchGame(run, job!, sample(job!.candidateSide));
  expect(rankings(run).find(row => row.profile.id === job!.profile.id)?.fields).toBe(0);
  const next = searchState(run).job!;
  expect(next.test.seed).toBe(job!.test.seed);
  expect(next.profile).toEqual(job!.profile);
  expect(next.candidateSide).not.toBe(job!.candidateSide);
  expect(initialGame(next.test)).toEqual(initialGame(job!.test));
  run = recordSearchGame(run, next, sample('repetition'));
  expect(rankings(run)[0]).toMatchObject({ fields: 1, wins: 1, losses: 0, repetitions: 1, net: 1 });
});

it.each(['validated', 'inconclusive', 'no-finalist'] as const)('handles the full tournament and emits %s', verdict => {
  let run = createSearch(searchDefaults, 'build', 'test');
  for (let i = 0; i < maximumGames; i++) {
    const { job } = searchState(run);
    if (!job) break;
    const preferred = job.profile.id === 'C3';
    const outcome = verdict === 'no-finalist' || job.phase === 'validation' && verdict === 'inconclusive'
      ? 'limit' : preferred ? job.candidateSide : 'red';
    run = recordSearchGame(run, job, sample(outcome));
  }
  const state = searchState(run);
  expect(state.verdict).toBe(verdict);
  expect(run.results).toHaveLength(verdict === 'no-finalist' ? 72 : 96);
  const validation = run.results.filter(row => row.phase === 'validation');
  if (validation.length) {
    expect(new Set(validation.map(row => row.profile))).toEqual(new Set(['C3']));
    expect(state.score?.fields).toBe(12);
  }
  if (verdict === 'validated') expect(validatedProfile(run)?.profile.id).toBe('C3');
  else expect(validatedProfile(run)).toBeUndefined();
});

it('runs real hard decisions through the shared rules and aggregates a replayable compact trace', () => {
  const run = createSearch(searchDefaults, 'build', 'test');
  const { test, profile, candidateSide } = searchState(run).job!;
  const summary = simulateSummary(test, { limit: 2, profiles: { [candidateSide]: profile.values }, trace: true });
  expect(summary.outcome).toBe('limit');
  expect(summary.commands).toBe(2);
  expect(summary.stats.red.decisions).toBe(1);
  expect(summary.stats.blue.decisions).toBe(1);
  expect(summary.stats.red.evaluated).toBeGreaterThan(0);
  const states = summary.trace!.reduce((games, command) => [...games, applyComputerCommand(games.at(-1)!, command)], [initialGame(test)]);
  expect(states.map(game => game.active)).toEqual(['red', 'blue', 'blue']);
}, 15000);
