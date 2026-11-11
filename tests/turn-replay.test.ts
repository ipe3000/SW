import { expect, it } from 'vitest';
import { newMatch, defaultOptions, undoActivation, wizard, type ChronicleEvent, type Activation } from '../src/engine/game';
import { applyGameAction, readGameAction } from '../src/engine/commands';
import { readMatch } from '../src/engine/backup';
import { presentTurn } from '../src/engine/presentation';
import { duelChronicle } from '../src/engine/chronicle';

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
  expect(restored.replays!.red!.entries[0].after.chronicle).toBeUndefined();
  expect(duelChronicle(restored.game)).toEqual(duelChronicle(next.game));
  expect(duelChronicle(restored.game).join(' ')).toMatch(/Lamarcana Rossa.*Lamarcana Blu cadde.*tre superstiti/);
});

it('registra gli effetti di un’abilità confermata e li scarta se viene annullata', () => {
  const match = normalTurn();
  wizard(match.game, 'red:geomancer')!.pos = { x: 4, y: 4 };
  wizard(match.game, 'blue:illusionist')!.pos = { x: 5, y: 4 };
  match.game.copies.push({ ownerId: 'blue:illusionist', side: 'blue', pos: { x: 6, y: 4 } });
  const next = applyGameAction(match, { kind: 'activate', activation: {
    wizardId: 'red:geomancer', before: [], after: [], spell: { kind: 'earth', targetId: 'blue:illusionist' },
  } });
  const restored = readMatch(JSON.parse(JSON.stringify(next)));
  expect(restored.game.chronicle?.[0].effects).toEqual(['damage', 'fade', 'restrain'].map(kind => ({ kind, wizardId: 'blue:illusionist' })));
  expect(duelChronicle(restored.game)).toEqual([]);
  expect(undoActivation(restored).game.chronicle).toBeUndefined();
});


it('salva chi ha ammaliato il mago e annulla la voce insieme alla sua attivazione', () => {
  const match = normalTurn();
  wizard(match.game, 'red:aeromancer')!.pos = { x: 4, y: 4 };
  wizard(match.game, 'blue:enchanter')!.pos = { x: 5, y: 4 };
  const action = { kind: 'activate', activation: move('red:aeromancer', 4, 5) } as const;
  const restored = readMatch(JSON.parse(JSON.stringify(applyGameAction(match, action))));
  expect(restored.game.chronicle).toEqual([{
    turn: match.game.turn, activation: action.activation, charmedBy: 'blue:enchanter', effects: [],
  }]);
  expect(undoActivation(restored).game.chronicle).toBeUndefined();

  match.game.phase = 2;
  expect(applyGameAction(match, action).game.chronicle).toBeUndefined();
});

it('dedica la quarta scena alla caduta di un mago già protagonista', () => {
  const { game } = normalTurn();
  game.id = 'cronaca';
  game.stage = 'finished';
  game.result = { winner: 'blue', loser: 'red', reason: 'Tre superstiti.' };
  game.wizards = game.wizards.filter(w => w.side === 'blue' || ['spellsword', 'geomancer', 'enchanter'].includes(w.kind));
  const scene = (turn: number, wizardId: string, spell: Activation['spell'], hit: string[], removed: string[]): ChronicleEvent => ({
    turn, activation: { wizardId, before: [], after: [], spell },
    effects: [
      ...hit.map(wizardId => ({ kind: 'damage' as const, wizardId })),
      ...removed.map(wizardId => ({ kind: 'removed' as const, wizardId })),
    ],
  });
  game.chronicle = [
    scene(7, 'blue:electromancer', { kind: 'lightning' }, ['blue:pyromancer', 'red:illusionist', 'red:pyromancer', 'red:teleporter'], []),
    scene(9, 'blue:pyromancer', { kind: 'fireball', center: { x: 4, y: 4 } }, ['red:teleporter', 'red:illusionist', 'red:enchanter'], ['red:illusionist']),
    scene(10, 'red:spellsword', { kind: 'sword', targetId: 'blue:pyromancer' }, ['blue:pyromancer'], ['blue:pyromancer']),
    scene(14, 'red:pyromancer', { kind: 'fireball', center: { x: 4, y: 4 } }, ['blue:illusionist', 'blue:aeromancer', 'blue:teleporter'], ['blue:illusionist', 'blue:teleporter']),
    scene(17, 'blue:aeromancer', { kind: 'wind', targetId: 'red:pyromancer', path: [] }, ['red:pyromancer'], ['red:pyromancer']),
  ];
  const story = duelChronicle(game);
  expect(story).toHaveLength(4);
  expect(story[0]).toContain('Piromante Blu');
  expect(story[1]).toContain('Il Piromante Blu cadde');
  expect(story[2]).toContain('Teletrasportatore Blu caddero');
  expect(story[3]).toContain('tre superstiti');
  expect(story.join(' ')).not.toContain('Elettromante Blu');

  game.chronicle = [
    { turn: 16, activation: move('red:pyromancer', 4, 5), charmedBy: 'blue:enchanter', effects: [] },
    game.chronicle[4],
  ];
  expect(duelChronicle(game)[0]).toMatch(/(?:Incantatore Blu.*Piromante Rosso|Piromante Rosso.*Incantatore Blu)/);
});
