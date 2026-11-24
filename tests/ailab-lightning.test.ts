import { expect, it } from 'vitest';
import { evaluator } from '../src/ai/didactic';
import { defaultHardProfile } from '../src/ai/profile';
import { lightningReward, withLightningReward } from '../src/ai/lightning';
import { applyComputerCommand, type ComputerCommand } from '../src/ai/types';
import { createGame, defaultOptions, wizard } from '../src/engine/game';
import { createSearch, gameBudget, lightningDefaults, lightningStudy, recordSearchGame, searchDefaults, searchState, wallGroup } from '../src/ailab/autotune';
import { initialGame } from '../src/ailab/model';
import { emptyLightningStats, recordLightning, type MatchSummary } from '../src/ailab/simulation';

it('uses F6–C5 first and keeps rotated pilot and reserve fields separate', () => {
  const config = { ...searchDefaults, lightning: { ...lightningDefaults, fields: 8 } };
  const pilot = createSearch(config, 'build', 'test');
  const reserve = createSearch({ ...config, lightning: { ...config.lightning, sample: 'reserve' } }, 'build', 'test');
  const fields = pilot.fields.screening;
  expect(initialGame(fields[0]).walls).toEqual([{ x: 5, y: 4 }, { x: 2, y: 5 }]);
  expect(new Set([...fields, ...reserve.fields.screening].map(wallGroup)).size).toBe(16);
  expect(pilot.profiles[0].values).toEqual(defaultHardProfile);
  expect(pilot.baseline).toEqual(defaultHardProfile);
  expect(gameBudget(config)).toBe(16);
  expect(() => createSearch({ ...config, lightning: { ...config.lightning, bonus: 101 } }, 'build', 'test')).toThrow();
});

it('uses paired results and attributes telemetry by experimental role when colors swap', () => {
  const config = { ...searchDefaults, lightning: { ...lightningDefaults, fields: 1 } };
  let run = createSearch(config, 'build', 'test');
  const { job } = searchState(run);
  const stats = { decisions: 0, milliseconds: 0, maxMs: 0, evaluated: 0, timedOut: 0, nodesExhausted: 0, fallbacks: 0 };
  const sample: MatchSummary = { outcome: 'red', elapsed: 1, commands: 0, stats: { red: stats, blue: stats },
    lightning: { red: { ...emptyLightningStats(), casts: 3 }, blue: { ...emptyLightningStats(), casts: 1 } } };
  expect(job).toMatchObject({ lightning: { mode: 'impact', bonus: 30 }, candidateSide: 'red', test: { red: 'hard', blue: 'hard' } });
  run = recordSearchGame(run, job!, sample);
  expect(lightningStudy(run).measuredFields).toBe(0);
  const next = searchState(JSON.parse(JSON.stringify(run))).job!;
  expect(next).toMatchObject({ lightning: { mode: 'impact', bonus: 30 }, candidateSide: 'blue' });
  expect(initialGame(next.test)).toEqual(initialGame(job!.test));
  run = recordSearchGame(run, next, { ...sample, outcome: 'blue' });
  expect(searchState(run).verdict).toBe('lightning-complete');
  expect(lightningStudy(run)).toMatchObject({ wins: 2, losses: 0, positiveFields: 1, measuredFields: 1,
    candidate: { casts: 4 }, reference: { casts: 4 } });
});

it('counts actual friendly and enemy damage and kills from a legal chain after movement', () => {
  const game = createGame(defaultOptions, () => .8);
  const caster = wizard(game, 'red:electromancer')!;
  caster.pos = { x: 3, y: 3 };
  const ally = wizard(game, 'red:geomancer')!, enemy = wizard(game, 'blue:geomancer')!;
  ally.pos = { x: 5, y: 3 }; ally.hp = 1;
  enemy.pos = { x: 6, y: 3 }; enemy.hp = 1;
  const command: ComputerCommand = { kind: 'activate', activation: { wizardId: caster.id, before: [{ x: 4, y: 3 }], spell: { kind: 'lightning' }, after: [] } };
  const stats = emptyLightningStats();
  recordLightning(stats, game, command, applyComputerCommand(game, command));
  expect(stats).toMatchObject({ main: 1, electromancerMain: 1, casts: 1, allyDamage: 1, allyKills: 1, enemyDamage: 1, enemyKills: 1 });
  recordLightning(stats, { ...game, phase: 2 }, { kind: 'activate', activation: { wizardId: caster.id, before: [], after: [{ x: 4, y: 3 }] } }, game);
  expect(stats).toMatchObject({ extra: 1, electromancerExtra: 1, casts: 1 });
  expect(lightningReward(game, command, applyComputerCommand(game, command), 30)).toBe(0);
  ally.hp = 2;
  const reward = lightningReward(game, command, applyComputerCommand(game, command), 30);
  expect(reward).toBe(25.5);
  expect(withLightningReward(4, reward)).toBe(29.5);
  expect(withLightningReward(1_000_000, reward)).toBe(1_000_000);
  expect(withLightningReward(-1_000_000, 200)).toBe(-1_000_000);
  expect(lightningReward(game, command, applyComputerCommand(game, command), 0)).toBe(0);
  expect(lightningReward(game, { kind: 'skip' }, game, 30)).toBe(0);
  ally.hp = 1;
  enemy.hp = 2;
  expect(lightningReward(game, command, applyComputerCommand(game, command), 30)).toBe(-25.5);
});

it('interprets checkpoints without a mode as opportunity studies', () => {
  const run = createSearch({ ...searchDefaults, lightning: { bonus: 30, fields: 1, sample: 'pilot' } }, 'build', 'test');
  delete run.config.lightning?.mode;
  expect(searchState(run).job?.lightning).toEqual({ mode: 'opportunity', bonus: 30 });
});

it('boosts a favorable chain only in tactical evaluation and leaves other mages at their weights', () => {
  const game = createGame(defaultOptions, () => .8);
  wizard(game, 'red:electromancer')!.pos = { x: 3, y: 3 };
  const a = wizard(game, 'blue:geomancer')!;
  a.pos = { x: 4, y: 3 }; a.hp = 1;
  wizard(game, 'blue:illusionist')!.pos = { x: 5, y: 3 };
  const score = evaluator(game, true, false, defaultHardProfile)(game);
  expect(evaluator(game, true, false, defaultHardProfile, 0)(game)).toBe(score);
  expect(evaluator(game, true, false, defaultHardProfile, 30)(game)).toBeGreaterThan(score);
  expect(evaluator(game, false, false, defaultHardProfile, 30)(game)).toBe(evaluator(game, false, false, defaultHardProfile)(game));
  const otherMages = { ...game, wizards: game.wizards.filter(mage => mage.kind !== 'electromancer') };
  expect(evaluator(otherMages, true, false, defaultHardProfile, 30)(otherMages)).toBe(evaluator(otherMages, true, false, defaultHardProfile)(otherMages));
});
