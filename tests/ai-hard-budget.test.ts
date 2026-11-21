import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { planningBudgets } from '../src/ai/planner';
import * as planner from '../src/ai/planner';
import { chooseMove } from '../src/ai/search';
import { ai2HardProfile, defaultHardProfile } from '../src/ai/profile';
import { evaluator } from '../src/ai/didactic';
import { evaluator as frozenEvaluator } from '../scripts/ai-versions/tactical-reinforcements-20261120/didactic';
import { syntheticSafetyPosition } from './ai-positions';
import { activate, newMatch, wizard } from '../src/engine/game';

it('keeps untouched AI #2 modules and the original budgets', () => {
  const root = 'scripts/ai-versions/tactical-reinforcements-20261120/';
  const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8'));
  const canonical = (source: string) => source.replace(/\r\n/g, '\n').trimEnd();
  for (const name of Object.keys(manifest.frozen)) {
    if (['didactic', 'planner', 'search'].includes(name)) continue;
    const live = readFileSync(`src/ai/${name}.ts`, 'utf8');
    const frozen = readFileSync(`${root}${name}.ts`, 'utf8').replaceAll('../../../src/engine/', '../engine/');
    expect(canonical(live), name).toBe(canonical(frozen));
  }
  expect(planningBudgets.normal.milliseconds).toBe(750);
  expect(planningBudgets.hard.milliseconds).toBe(3200);
  expect(planningBudgets.hard.nodes).toBe(120_000);
});

it('evaluates opening, contact and terminal positions exactly as AI #2 with historical weights', () => {
  const opening = newMatch().game;
  const developed = activate(opening, { wizardId: 'red:spellsword', before: [{ x: 8, y: 8 }], after: [] });
  const contact = syntheticSafetyPosition();
  wizard(contact, 'red:pyromancer')!.pos = { x: 4, y: 4 };
  const terminal = { ...contact, result: { winner: 'blue' as const, loser: 'red' as const, reason: '' } };
  for (const base of [opening, contact]) {
    const live = evaluator(base, true, true), reference = frozenEvaluator(base, true, true);
    for (const position of [opening, developed, contact, terminal]) expect(live(position)).toBe(reference(position));
  }
});

it('uses G8-C3 in the normal Hard entry point and lets comparisons select AI #2', () => {
  const planned = vi.spyOn(planner, 'choosePlannedMove').mockReturnValue({ command: { kind: 'skip' }, evaluated: 0 });
  try {
    const game = newMatch().game;
    expect(defaultHardProfile).toEqual({ initiative: 1.1147, reinforcements: 1.0893, opening: .9216, danger: .9444, area: 1.1619 });
    chooseMove(game, 'hard');
    expect(planned.mock.lastCall?.[4]).toEqual(defaultHardProfile);
    chooseMove(game, 'hard', undefined, ai2HardProfile);
    expect(planned.mock.lastCall?.[4]).toEqual(ai2HardProfile);
    chooseMove(game, 'normal');
    expect(planned.mock.lastCall?.[4]).toBeUndefined();
  } finally { planned.mockRestore(); }
});
