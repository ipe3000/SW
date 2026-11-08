import { expect, it } from 'vitest';
import { newMatch, defaultOptions, undoActivation, wizard, type Activation } from '../src/engine/game';
import { applyGameAction, readGameAction } from '../src/engine/commands';
import { readMatch } from '../src/engine/backup';
import { presentTurn } from '../src/engine/presentation';

const move = (wizardId: string, x: number, y: number): Activation => ({ wizardId, before: [{ x, y }], after: [] });
const first = move('red:aeromancer', 5, 8), second = move('red:pyromancer', 3, 8), extra = move('red:illusionist', 6, 8);
function normalTurn() { const m = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); m.game.turn = 2; return m; }

it('conferma il primo turno in un solo comando e conserva i vecchi comandi espliciti', () => {
  const m = newMatch(), next = applyGameAction(m, { kind: 'activate', activation: first, finishTurn: true });
  expect(next.game.active).toBe('blue'); expect(next.undo).toEqual([]); expect(next.revision).toBe(1);
  expect(next.replays?.red?.entries).toHaveLength(1);
  const old = applyGameAction(m, { kind: 'activate', activation: first });
  expect(old.game.phase).toBe(3); expect(old.game.active).toBe('red');
  expect(applyGameAction(old, { kind: 'end-turn' }).game).toEqual(next.game);
  expect(readGameAction({ kind: 'activate', activation: first, finishTurn: true })).toMatchObject({ finishTurn: true });
});

it('registra tutte le attivazioni del turno, compreso il passo extra, anche dopo il ripristino', () => {
  let m = applyGameAction(normalTurn(), { kind: 'activate', activation: first });
  m = readMatch(JSON.parse(JSON.stringify(m)));
  m = applyGameAction(m, { kind: 'activate', activation: second });
  expect(m.game.phase).toBe(2); expect(m.game.active).toBe('red');
  m = applyGameAction(m, { kind: 'activate', activation: extra, finishTurn: true });
  const restored = readMatch(JSON.parse(JSON.stringify(m))), turn = restored.replays!.red!;
  expect(turn.entries).toHaveLength(3); expect(turn.end.active).toBe('blue'); expect(turn.start.phase).toBe(0);
  const before = JSON.stringify(restored), presentation = presentTurn(turn);
  expect(presentation.frames.filter(frame => frame.movement).map(frame => frame.actorId)).toEqual([first.wizardId, second.wizardId, extra.wizardId]);
  expect(presentation.frames.at(-1)?.game).toEqual(turn.end); expect(JSON.stringify(restored)).toBe(before);
  expect(turn.entries.every(entry => !entry.before.log.length && !entry.after.log.length)).toBe(true);
});

it('esclude dal replay le azioni annullate e passa la mano saltando il passo extra', () => {
  let m = applyGameAction(normalTurn(), { kind: 'activate', activation: first });
  m = applyGameAction(m, { kind: 'activate', activation: second });
  m = undoActivation(m); expect(m.replays?.current?.entries).toHaveLength(1);
  m = applyGameAction(m, { kind: 'skip' });
  m = applyGameAction(m, { kind: 'skip', finishTurn: true });
  expect(m.game.active).toBe('blue'); expect(m.replays?.red?.entries.map(entry => entry.activation)).toEqual([first]);
  expect(() => undoActivation(m)).toThrow(); expect(readMatch(m).replays).toEqual(m.replays);
});

it('impedisce di perdere fasi disponibili con una conferma finale non valida', () => {
  const m = normalTurn(), before = JSON.stringify(m);
  expect(() => applyGameAction(m, { kind: 'activate', activation: first, finishTurn: true })).toThrow('restano azioni');
  expect(() => applyGameAction(m, { kind: 'skip', finishTurn: true })).toThrow('Restano fasi');
  expect(JSON.stringify(m)).toBe(before);
  expect(() => readGameAction({ kind: 'skip', finishTurn: false })).toThrow();
});

it('non inventa un turno completo da un vecchio salvataggio aperto a metà turno', () => {
  const m = normalTurn(); m.game.phase = 2; m.game.activity = true;
  const next = applyGameAction(m, { kind: 'activate', activation: extra, finishTurn: true });
  expect(next.replays?.red).toBeUndefined(); expect(next.game.active).toBe('blue');
});

it('rifiuta un replay i cui effetti non corrispondono al comando registrato', () => {
  const m = applyGameAction(newMatch(), { kind: 'activate', activation: first, finishTurn: true });
  const altered = structuredClone(m); altered.replays!.red!.entries[0].activation.before = [];
  expect(() => readMatch(altered)).toThrow();
});

it('salva e ripristina un turno vincente con il risultato definitivo e il replay del colpo', () => {
  const m = normalTurn(); wizard(m.game, 'red:spellsword')!.pos = { x: 4, y: 4 }; wizard(m.game, 'blue:spellsword')!.pos = { x: 5, y: 4 }; wizard(m.game, 'blue:spellsword')!.hp = 2;
  m.game.wizards = m.game.wizards.filter(w => w.side === 'red' || ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
  const next = applyGameAction(m, { kind: 'activate', activation: { wizardId: 'red:spellsword', before: [], after: [], spell: { kind: 'sword', targetId: 'blue:spellsword' } }, finishTurn: true });
  const restored = readMatch(JSON.parse(JSON.stringify(next)));
  expect(restored.game.result?.winner).toBe('red'); expect(restored.replays?.red?.entries).toHaveLength(1);
  expect(presentTurn(restored.replays!.red!).frames.some(frame => frame.cues.some(cue => cue.kind === 'removed'))).toBe(true);
});
