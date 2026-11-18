import { expect, it } from 'vitest';
import { casesFor, defaults, initialGame, markdown, repetitionKey, statistics, type Campaign } from '../src/ailab/model';

it('pairs every matchup on identical fields and swaps difficulty assignments', () => {
  const cases = casesFor(defaults);
  expect(cases).toHaveLength(18);
  for (let index = 0; index < cases.length; index += 2) {
    const a = cases[index], b = cases[index + 1];
    expect(a.red).toBe(b.blue); expect(a.blue).toBe(b.red);
    expect(initialGame(a)).toEqual(initialGame(b));
  }
  expect(new Set(cases.map(test => test.hp))).toEqual(new Set([3,4,5]));
  expect(new Set(cases.map(test => test.walls))).toEqual(new Set(['standard','varied']));
  expect(() => casesFor({ ...defaults, fields: 0 })).toThrow();
  expect(() => casesFor({ ...defaults, limit: NaN })).toThrow();
});

it('recognizes repetitions across turn numbers without discarding restraint duration', () => {
  const game = initialGame(casesFor(defaults)[0]);
  expect(repetitionKey(game)).toBe(repetitionKey({ ...game, turn: game.turn + 2 }));
  const restrained = structuredClone(game); restrained.wizards[0].restrainedUntil = game.turn + 1;
  expect(repetitionKey(restrained)).not.toBe(repetitionKey(game));
});

it('exports inconclusive outcomes and proven tactical findings with trace references', () => {
  const test = casesFor(defaults)[0], game = initialGame(test);
  const campaign: Campaign = { format: 'strategic-wizardry-ailab', schema: 1, id: 'test', created: '2026-11-18', build: 'fingerprint', userAgent: 'test', config: defaults, cases: [test], results: [{ test, outcome: 'limit', steps: [], final: game, findings: [{ kind: 'missed-win', step: 4, side: 'red', alternative: { kind: 'skip' } }], elapsed: 0, audits: { completed: 1, interrupted: 1 } }] };
  const report = markdown(campaign);
  expect(report).toContain('fingerprint'); expect(report).toContain('comando 5');
  expect(report).toContain('limit'); expect(report).toContain('non sono vittorie');
  expect(statistics(campaign.results).map(row => row.incomplete)).toEqual([1, 1]);
  expect(statistics([{ ...campaign.results[0], test: { ...test, red: 'easy', blue: 'easy' }, outcome: 'red' }])[0]).toMatchObject({ wins: 1, losses: 1, incomplete: 0 });
});
