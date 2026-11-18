import { expect, it } from 'vitest';
import { casesFor, defaults, initialGame, markdown, repetitionKey, statistics, physicalPositionKey, phaseStatistics, type Campaign } from '../src/ailab/model';

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

it('deduplicates all 36 standard boards and rejects impossible sample sizes', () => {
  const config = { ...defaults, hp:4 as const, walls:'standard' as const, fields:36 };
  const cases=casesFor(config);
  expect(new Set(cases.map(test=>physicalPositionKey(initialGame(test)))).size).toBe(36);
  expect(casesFor(config)).toEqual(cases);
  expect(()=>casesFor({...config,fields:37})).toThrow(/36/);
  expect(new Set(casesFor({...defaults,hp:4,walls:'standard'}).map(test=>test.fieldKey)).size).toBe(3);
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
  expect(report).toContain('Catalogo dei campi'); expect(report).toContain('legacy');
  expect(phaseStatistics(campaign.results)).toEqual([]);
  expect(statistics(campaign.results).map(row => row.incomplete)).toEqual([1, 1]);
  expect(statistics([{ ...campaign.results[0], test: { ...test, red: 'easy', blue: 'easy' }, outcome: 'red' }])[0]).toMatchObject({ wins: 1, losses: 1, incomplete: 0 });
});
