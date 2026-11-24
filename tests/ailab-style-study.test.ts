import { expect, it } from 'vitest';
import { initialGame, type Result } from '../src/ailab/model';
import { styleCases, styleDefaults, styleSummary, styleVariantFor } from '../src/ailab/style-study';
import { speed, wizard } from '../src/engine/game';

it('plays one Hard mirror game per rule combination on the same starting field', () => {
  const cases = styleCases({ ...styleDefaults, fields: 2, safeLightning: true, shorterSpellswordMove: true });
  expect(cases).toHaveLength(8);
  for (const group of [cases.slice(0, 4), cases.slice(4)]) {
    expect(new Set(group.map(row => styleVariantFor(row).id)).size).toBe(4);
    const first = initialGame(group[0]);
    for (const row of group) {
      const game = initialGame(row);
      expect(game.walls).toEqual(first.walls);
      expect(game.wizards).toEqual(first.wizards);
      expect(game.id).toBe(first.id);
      expect([row.red, row.blue]).toEqual(['hard', 'hard']);
      expect(speed(game, wizard(game, 'red:spellsword')!)).toBe(row.shorterSpellswordMove ? 3 : 4);
      expect(Boolean(game.options.safeLightning)).toBe(row.safeLightning);
    }
  }
  expect(styleVariantFor(cases[0]).id).not.toBe(styleVariantFor(cases[4]).id);
});

it('excludes extra steps and compares only fields played under all four rules', () => {
  const results: Result[] = styleCases({ ...styleDefaults, fields: 2 }).map(test => {
    const game = initialGame(test);
    const activation = { wizardId: 'red:electromancer', before: [], after: [] };
    return {
      test, outcome: 'limit', final: game, elapsed: 0, findings: [], audits: { completed: 0, interrupted: 0 },
      steps: [
        { before: game, command: { kind: 'activate', activation: { ...activation, spell: { kind: 'lightning' } } }, milliseconds: 0, evaluated: 0 },
        { before: { ...game, phase: 2 }, command: { kind: 'activate', activation }, milliseconds: 0, evaluated: 0 },
      ],
    };
  });
  expect(styleSummary(results.slice(0, 3)).every(row => row.games === 0)).toBe(true);
  expect(styleSummary(results.slice(0, 5)).every(row => row.games === 1 && row.main === 1 && row.mages.electromancer.spells === 1)).toBe(true);
  results[7].outcome = 'error';
  expect(styleSummary(results).every(row => row.games === 1 && row.limits === 1)).toBe(true);
});
