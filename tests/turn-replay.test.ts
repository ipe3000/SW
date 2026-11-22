import { expect, it } from 'vitest';
import { newMatch, defaultOptions, undoActivation, wizard, type Activation } from '../src/engine/game';
import { applyGameAction, readGameAction } from '../src/engine/commands';
import { readMatch } from '../src/engine/backup';
import { presentTurn } from '../src/engine/presentation';
import { availableTurns, summarizeDuel } from '../src/engine/duel-recap';

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
  expect(applyGameAction(old, { kind: 'end-turn' }).recap).toEqual(next.recap);
  expect(undoActivation(readMatch(old)).recap).toEqual([]);
  expect(readGameAction({ kind: 'activate', activation: first, finishTurn: true })).toMatchObject({ finishTurn: true });
});

it('conta i PV realmente persi e le eliminazioni dopo il salvataggio', () => {
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  wizard(match.game, 'red:spellsword')!.pos = { x: 4, y: 4 };
  wizard(match.game, 'blue:spellsword')!.pos = { x: 5, y: 4 };
  wizard(match.game, 'blue:spellsword')!.hp = 1;
  match.game.wizards = match.game.wizards.filter(w => w.side === 'red' || ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
  const finished = applyGameAction(match, { kind: 'activate', finishTurn: true, activation: {
    wizardId: 'red:spellsword', before: [], after: [], spell: { kind: 'sword', targetId: 'blue:spellsword' },
  } });
  const restored = readMatch(JSON.parse(JSON.stringify(finished)));
  const recap = summarizeDuel(restored.recap!);
  expect(recap.guilds.red).toMatchObject({ enemy: 1, friendly: 0 });
  expect(recap.mages['red:spellsword']).toMatchObject({ full: 1, abilities: 1 });
  expect(recap.mages['blue:spellsword']?.lost).toEqual({ ally: 0, enemy: 1 });
  expect(recap.damageByTurn.get(1)).toEqual({ red: 0, blue: 1 });
  expect(recap.eliminated['blue:spellsword']).toBe(1);
  expect(availableTurns(restored.game, 'blue:spellsword', 1)).toBe(0);
});

it('conta un turno intero a fine turno anche per un mago mai attivato', () => {
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  wizard(match.game, 'red:pyromancer')!.pos = { x: 4, y: 4 };
  wizard(match.game, 'blue:enchanter')!.pos = { x: 5, y: 4 };
  const activated = applyGameAction(match, { kind: 'activate', activation: first });
  expect(summarizeDuel(activated.recap!).guilds.blue.applied.charms).toBe(0);
  expect(undoActivation(readMatch(activated)).recap).toEqual([]);
  const restored = readMatch(applyGameAction(activated, { kind: 'end-turn' }));
  const stats = summarizeDuel(restored.recap!);
  expect(stats.charmTurns.size).toBe(1);
  expect(stats.guilds.blue.applied.charms).toBe(1);
  expect(stats.mages['red:pyromancer']).toMatchObject({ usedTurns: 0, received: { charms: 1 } });
});

it('esclude il mago che esce e rientra sotto ammaliamento tra due azioni confermate', () => {
  const match = normalTurn();
  match.recap = [];
  wizard(match.game, 'red:pyromancer')!.pos = { x: 4, y: 5 };
  wizard(match.game, 'blue:enchanter')!.pos = { x: 4, y: 4 };
  wizard(match.game, 'red:teleporter')!.pos = { x: 5, y: 5 };
  wizard(match.game, 'red:aeromancer')!.pos = { x: 5, y: 2 };
  const displaced = applyGameAction(match, { kind: 'activate', activation: {
    wizardId: 'red:teleporter', before: [], after: [],
    spell: { kind: 'teleport', targetId: 'blue:enchanter', destination: { x: 5, y: 4 } },
  } });
  const returned = applyGameAction(readMatch(displaced), { kind: 'activate', activation: {
    wizardId: 'red:aeromancer', before: [], after: [],
    spell: { kind: 'wind', targetId: 'blue:enchanter', path: [{ x: 4, y: 4 }] },
  } });
  const restored = readMatch(applyGameAction(returned, { kind: 'end-turn' }));
  expect(restored.recap?.at(-1)).toMatchObject({ kind: 'turn-end', charmed: [] });
});

it('separa gli spostamenti per abilità e lato del bersaglio', () => {
  const stats = summarizeDuel([
    { kind: 'activation', mage: 'red:aeromancer', turn: 0, logLength: 1, extra: false, ability: true, impacts: [{ kind: 'move', target: 'blue:geomancer' }] },
    { kind: 'activation', mage: 'blue:teleporter', turn: 1, logLength: 3, extra: false, ability: true, impacts: [{ kind: 'move', target: 'blue:geomancer' }] },
    { kind: 'activation', mage: 'blue:geomancer', turn: 1, logLength: 4, extra: false, ability: true, impacts: [{ kind: 'restrain', target: 'red:aeromancer' }] },
  ]);
  expect(stats.guilds.red.applied.wind).toEqual({ ally: 0, enemy: 1 });
  expect(stats.guilds.blue.applied.teleport).toEqual({ ally: 1, enemy: 0 });
  expect(stats.guilds.blue.applied.restraints).toBe(1);
  expect(stats.mages['blue:geomancer']?.received).toMatchObject({ wind: { enemy: 1 }, teleport: { ally: 1 } });
  expect(stats.mages['red:aeromancer']?.received.restraints).toBe(1);
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
  const legacy = { ...next, game: { ...next.game, chronicle: [{
    turn: m.game.turn,
    activation: next.replays!.red!.entries[0].activation,
    effects: [
      { kind: 'damage', wizardId: 'blue:spellsword' },
      { kind: 'removed', wizardId: 'blue:spellsword' },
    ],
  }] } };
  const restored = readMatch(JSON.parse(JSON.stringify(legacy)));
  expect(restored.game).toEqual(next.game);
  expect(restored.game.log).toContainEqual(expect.stringContaining('Lamarcana'));
  expect(restored.game.result?.winner).toBe('red'); expect(restored.replays?.red?.entries).toHaveLength(1);
  expect(presentTurn(restored.replays!.red!).frames.some(frame => frame.cues.some(cue => cue.kind === 'removed'))).toBe(true);
});
