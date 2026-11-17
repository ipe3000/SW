import { describe, expect, it } from 'vitest';
import { defaultOptions, newMatch, wizard, type Game, type Kind, type Side } from '../src/engine/game';
import { applyComputerCommand } from '../src/ai/types';
import { choosePlannedMove } from '../src/ai/planner';
import { activationSeeds } from '../src/ai/candidates';
import { decisionPosition } from '../src/ai/position';

function position(pieces: [Side, Kind, number, number, number][]): Game {
  const game = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8).game;
  game.walls = []; game.turn = 2;
  game.wizards = pieces.map(([side, kind, x, y, hp]) => ({ ...wizard(game, `${side}:${kind}`)!, pos: { x, y }, hp }));
  return game;
}

describe('AI: pianificazione e difesa', () => {
  it.each(['normal', 'hard'] as const)('%s non regala il quarto mago per un danno immediato', level => {
    const game = position([
      ['red', 'spellsword', 4, 4, 2], ['red', 'teleporter', 0, 9, 4],
      ['red', 'geomancer', 1, 9, 4], ['red', 'illusionist', 2, 9, 4],
      ['blue', 'spellsword', 7, 4, 4], ['blue', 'geomancer', 5, 4, 4],
      ['blue', 'teleporter', 9, 0, 4], ['blue', 'illusionist', 8, 0, 4], ['blue', 'aeromancer', 7, 0, 4]
    ]);
    game.phase = 1; game.activity = true; game.activated = ['red:geomancer'];
    const original = structuredClone(game);
    const decision = choosePlannedMove(game, level), after = applyComputerCommand(game, decision.command);
    expect(game).toEqual(original);
    expect(after).not.toEqual(game);
    const enemyTurn = after.active === 'red' ? applyComputerCommand(after, { kind: 'skip' }) : after;
    expect(enemyTurn.active).toBe('blue');
    // Exhaustive legal attacks, independent of either AI's evaluation or shortlist.
    expect([...activationSeeds(enemyTurn)].some(candidate => candidate.game.pending?.winner === 'blue')).toBe(false);
  }, 20000);

  it('Difficile prepara con il teletrasporto una vittoria altrimenti irraggiungibile', () => {
    const game = position([
      ['red', 'teleporter', 4, 4, 4], ['red', 'spellsword', 4, 3, 4],
      ['red', 'geomancer', 0, 9, 4], ['red', 'illusionist', 1, 9, 4],
      ['blue', 'spellsword', 6, 4, 2], ['blue', 'aeromancer', 9, 0, 4],
      ['blue', 'teleporter', 8, 0, 4], ['blue', 'illusionist', 7, 0, 4]
    ]);
    wizard(game, 'red:spellsword')!.restrainedUntil = game.turn;
    const decision = choosePlannedMove(game, 'hard');
    expect(decision.command.kind).toBe('activate');
    if (decision.command.kind === 'activate') expect(decision.command.activation.spell?.kind).toBe('teleport');
    const after = applyComputerCommand(game, decision.command);
    expect(decision.continuation?.[0]?.position).toBe(decisionPosition(after));
    const planned=applyComputerCommand(after,decision.continuation![0].command);
    expect(planned.result?.winner ?? planned.pending?.winner).toBe('red');
    const won = applyComputerCommand(after, choosePlannedMove(after, 'hard').command);
    expect(won.result?.winner ?? won.pending?.winner).toBe('red');
  }, 15000);
});
