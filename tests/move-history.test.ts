import { expect, it, vi } from 'vitest';
import { applyGameAction, type GameAction } from '../src/engine/commands';
import { defaultOptions, newMatch, wizard, type Match } from '../src/engine/game';
import { readMatch } from '../src/engine/backup';
import { availableMoves, canReplaceMove, gameAt, lastHumanMove, movePoint, recordMove, replaceMove } from '../src/engine/move-history';

const move = (wizardId: string, x: number, y: number, finishTurn?: true): GameAction =>
  ({ kind: 'activate', activation: { wizardId, before: [{ x, y }], after: [] }, finishTurn });
const open = move('red:aeromancer', 5, 8, true);
const alternate = move('red:pyromancer', 3, 8, true);
const blue = move('blue:aeromancer', 4, 1);
const play = (match: Match, action: GameAction) => recordMove(match, applyGameAction(match, action));

it('retains stable boards, the initial dice, and the actor of each move across a backup', () => {
  const random = vi.fn().mockReturnValueOnce(.25).mockReturnValueOnce(.75);
  const initial = newMatch(defaultOptions, random);
  initial.computer = { profile: 'didactic-v1', side: 'blue' };
  const first = play(initial, open), current = play(first, blue);
  const saved = readMatch(JSON.parse(JSON.stringify(current)));
  const expected = [initial.game, first.game, current.game];
  const points = availableMoves(saved);
  expect(points.map(point => point.actor)).toEqual([undefined, 'red', 'blue']);
  for (const point of [...points, ...[...points].reverse()]) {
    expect(gameAt(saved.game, point)).toEqual(expected[points.indexOf(point)]);
  }
  expect(random).toHaveBeenCalledTimes(2);
  expect(lastHumanMove(points, 'red')).toBe(0);
  expect(canReplaceMove(saved, points, 1)).toBe(false);
  const before = structuredClone(saved);
  expect(() => replaceMove(saved, 0, blue)).toThrow();
  expect(saved).toEqual(before);
  const changed = readMatch(replaceMove(saved, 0, alternate));
  expect(changed.revision).toBe(saved.revision + 1);
  expect(changed.game).toEqual(applyGameAction(initial, alternate).game);
  expect(changed.moveHistory).toHaveLength(2);
  expect(changed.moveHistory?.[0]).toEqual(points[0]);
  expect(changed.moveHistory?.[1].manual).toBeUndefined();
  expect(play(current, { kind: 'undo' }).moveHistory).toEqual(first.moveHistory);
});

it('restores the turn prefix, undo and recap when changing a later move', () => {
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  match.computer = { profile: 'didactic-v1', side: 'both' };
  const first = play(match, open), second = play(first, blue);
  const third = play(second, move('blue:pyromancer', 6, 1));
  const complete = play(third, { kind: 'skip', finishTurn: true });
  const changed = replaceMove(readMatch(complete), 2, move('blue:illusionist', 3, 1));
  const normal = applyGameAction(second, move('blue:illusionist', 3, 1));
  expect(changed.game).toEqual(normal.game);
  expect(changed.undo).toEqual(normal.undo);
  expect(changed.recap).toEqual(normal.recap);
  expect(changed.replays).toEqual(normal.replays);
  expect(changed.moveHistory?.slice(0, 3)).toEqual(complete.moveHistory?.slice(0, 3));
  expect(readMatch(changed).moveHistory?.at(-1)).toMatchObject({ actor: 'blue', manual: true });
  const manual = replaceMove(changed, 3, { kind: 'skip', finishTurn: true });
  expect(manual.moveHistory).toHaveLength(5);
  expect(manual.moveHistory?.at(-1)?.manual).toBe(true);
});

it('uses the real boards from an old save and keeps incomplete history incomplete', () => {
  const match = newMatch();
  match.computer = { profile: 'didactic-v1', side: 'blue' };
  const first = applyGameAction(match, open), second = applyGameAction(first, blue), old = readMatch(second);
  expect(old.moveHistory).toBeUndefined();
  const points = availableMoves(old);
  expect(points.map(point => gameAt(old.game, point))).toEqual([match.game, first.game, second.game]);
  const limited = readMatch({ ...first, replays: undefined });
  expect(availableMoves(limited)).toEqual([movePoint(limited.game)]);
  expect(lastHumanMove(availableMoves(limited), 'red')).toBeUndefined();
});

it('tracks custom deployment actions without log entries, including placements across the handover', () => {
  let match = newMatch({ ...defaultOptions, placement: 'custom' });
  match.computer = { profile: 'didactic-v1', side: 'both' };
  for (let i = 1; i <= 4; i++) {
    const mage = match.game.wizards.find(w => w.side === 'red' && !w.pos)!;
    match = play(match, { kind: 'place', wizardId: mage.id, to: { x: i, y: 9 } });
  }
  expect(readMatch(match).moveHistory?.map(point => point.board.active)).toEqual(['red', 'red', 'red', 'red', 'blue']);
  const changed = replaceMove(match, 1, { kind: 'place', wizardId: 'red:aeromancer', to: { x: 8, y: 9 } });
  expect(changed.undo).toHaveLength(2);
  expect(readMatch(changed).moveHistory?.at(-1)).toMatchObject({ actor: 'red', manual: true, logLength: 0 });
});

it('can reopen and then finish the same match repeatedly with a correct new recap', () => {
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  match.computer = { profile: 'didactic-v1', side: 'both' };
  wizard(match.game, 'red:spellsword')!.pos = { x: 4, y: 4 };
  wizard(match.game, 'red:electromancer')!.pos = { x: 2, y: 6 };
  wizard(match.game, 'red:aeromancer')!.pos = { x: 2, y: 7 };
  wizard(match.game, 'red:aeromancer')!.hp = 1;
  wizard(match.game, 'blue:spellsword')!.pos = { x: 5, y: 4 };
  wizard(match.game, 'blue:spellsword')!.hp = 1;
  match.game.wizards = match.game.wizards.filter(w => (w.side === 'red'
    ? ['spellsword', 'electromancer', 'aeromancer', 'pyromancer']
    : ['spellsword', 'aeromancer', 'enchanter', 'teleporter']).includes(w.kind));
  const win: GameAction = { kind: 'activate', finishTurn: true, activation: {
    wizardId: 'red:spellsword', before: [], after: [], spell: { kind: 'sword', targetId: 'blue:spellsword' },
  } };
  const original = play(match, win);
  const replacedWin = readMatch(replaceMove(original, 0, { kind: 'activate', finishTurn: true, activation: {
    wizardId: 'red:electromancer', before: [], after: [], spell: { kind: 'lightning' },
  } }));
  expect(replacedWin.game.result?.winner).toBe('blue');
  expect(replacedWin.game.id).toBe(original.game.id);
  expect(replacedWin.recap).not.toEqual(original.recap);
  const reopened = readMatch(replaceMove(replacedWin, 0, alternate));
  expect(reopened.game.result).toBeNull();
  const finished = readMatch(replaceMove(reopened, 0, win));
  expect(finished.game.id).toBe(original.game.id);
  expect(finished.game.result?.winner).toBe('red');
  expect(finished.recap).toEqual(original.recap);
  expect(finished.moveHistory).toHaveLength(2);
});
