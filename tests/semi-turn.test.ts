import { expect, it } from 'vitest';
import { defaultOptions, newMatch, undoActivation, type Activation } from '../src/engine/game';
import { applyGameAction, readGameAction } from '../src/engine/commands';
import { append, makeSession, readJournal, replay, type Journal } from '../src/network/model';
import { commitComputerCommand } from '../src/ai/types';

const action: Activation = { wizardId: 'red:illusionist', before: [{ x: 6, y: 8 }], after: [] };
function semi() {
  const match = newMatch(); match.game.turn = 2; match.game.phase = 2; match.game.activity = true;
  match.game.activated = ['red:geomancer', 'red:pyromancer']; match.undo = [structuredClone(match.game)];
  match.game.wizards.find(w => w.id === 'red:spellsword')!.restrainedUntil = 2;
  return match;
}
it('la semiattivazione confermata muove, chiude il turno, fa scadere gli effetti e non è annullabile', () => {
  const match = semi(), next = applyGameAction(match, { kind: 'activate', activation: action, completeTurn: true });
  expect(next.revision).toBe(match.revision + 1); expect(next.game.active).toBe('blue'); expect(next.game.turn).toBe(3); expect(next.game.phase).toBe(0);
  expect(next.game.wizards.find(w => w.id === action.wizardId)!.pos).toEqual({ x: 6, y: 8 });
  expect(next.game.wizards.find(w => w.id === 'red:spellsword')!.restrainedUntil).toBeUndefined();
  expect(next.undo).toEqual([]); expect(() => undoActivation(next)).toThrow(); expect(match.game.phase).toBe(2);
});
it('il computer usa la stessa conclusione atomica della semiattivazione', () => {
  const match = semi(); match.computer = { profile: 'didactic-v1', side: 'red' };
  const next = commitComputerCommand(match, { kind: 'activate', activation: action });
  expect(next.game.active).toBe('blue'); expect(next.revision).toBe(match.revision + 1); expect(next.undo).toHaveLength(0);
});
it('non permette di usare la conclusione della semiattivazione nelle altre fasi', () => {
  expect(() => applyGameAction(newMatch(), { kind: 'activate', activation: action, completeTurn: true })).toThrow('semiattivazione');
  expect(() => readGameAction({ kind: 'activate', activation: action, completeTurn: false })).toThrow();
});
export function blueSemiJournal() {
  let journal = makeSession('Ada', undefined, defaultOptions).journal;
  const add = (actor: 'red' | 'blue', activation?: Activation) => { journal = append(journal, { id: `setup-${journal.events.length}`, actor, at: '2026-11-07T12:00:00Z', action: activation ? { kind: 'activate', activation } : { kind: 'end-turn' } }); };
  add('red', { wizardId: 'red:electromancer', before: [{ x: 1, y: 8 }], after: [] }); add('red');
  add('blue', { wizardId: 'blue:spellsword', before: [{ x: 1, y: 1 }], after: [] });
  add('blue', { wizardId: 'blue:enchanter', before: [{ x: 2, y: 1 }], after: [] });
  return journal;
}
it('riproduce la nuova conferma e i vecchi archivi online senza cambiare la loro storia', () => {
  const journal: Journal = blueSemiJournal(), activation = { wizardId: 'blue:illusionist', before: [{ x: 3, y: 1 }], after: [] };
  const event = { id: 'semi', actor: 'blue' as const, at: '2026-11-07T12:00:01Z', action: { kind: 'activate' as const, activation, completeTurn: true as const } };
  const modern = append(journal, event);
  expect(replay(readJournal(JSON.parse(JSON.stringify(modern))))).toEqual(replay(modern)); expect(replay(modern).game.active).toBe('red');
  const legacy = append(journal, { ...event, action: { kind: 'activate', activation } });
  expect(replay(legacy).game.phase).toBe(3); expect(replay(legacy).game.active).toBe('blue');
  const oldEnd = append(legacy, { id: 'old-explicit-end', actor: 'blue', at: event.at, action: { kind: 'end-turn' } });
  expect(replay(readJournal(oldEnd)).game).toEqual(replay(modern).game);
});
