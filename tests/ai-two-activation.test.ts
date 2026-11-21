import { expect, it } from 'vitest';
import { newMatch, wizard } from '../src/engine/game';
import { twoActivationWin } from '../src/ai/tactics';
import { applyComputerCommand } from '../src/ai/types';

it('reports an interrupted scan separately from an opening without a winning combination', () => {
  const game = newMatch().game;
  game.turn = 2;
  expect(twoActivationWin(game, performance.now() - 1)).toMatchObject({ complete: false });
  const clear = twoActivationWin(game, performance.now() + 1000);
  expect(clear.complete).toBe(true);
  expect(clear.line).toBeUndefined();
});

it('finds and legally replays a two-activation win against a 3 HP target', () => {
  const game = newMatch().game;
  game.turn = 2;
  game.walls = [];
  game.wizards = game.wizards.filter(w => w.side === 'red'
    ? ['spellsword', 'aeromancer', 'geomancer', 'teleporter'].includes(w.kind)
    : ['teleporter', 'illusionist', 'geomancer', 'electromancer'].includes(w.kind));
  const target = wizard(game, 'blue:teleporter')!;
  target.hp = 3;
  target.pos = { x: 4, y: 4 };
  wizard(game, 'red:spellsword')!.pos = { x: 4, y: 3 };
  wizard(game, 'red:aeromancer')!.pos = { x: 3, y: 4 };
  const scan = twoActivationWin(game, performance.now() + 1000, 4000);
  expect(scan.line).toHaveLength(2);
  let final = game;
  for (const command of scan.line!) final = applyComputerCommand(final, command);
  expect(final.result?.winner).toBe('red');
});
