import { describe, expect, it } from 'vitest';
import { activate, commitActivation, defaultOptions, endTurn, hasActivity, newMatch, skipPhase, type Match, type Point } from '../src/engine/game';
import { readMatch } from '../src/engine/backup';
import { applyGameAction } from '../src/engine/commands';
import { didactic } from '../src/ai/didactic';
import { applyComputerCommand } from '../src/ai/types';
import { append, fingerprint, makeSession, readJournal, readSession, replay, type Command } from '../src/network/model';
import { mergeImportedSession } from '../src/network/storage';

function position(positions: Record<string, [number, number]>): Match {
  const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8);
  match.game.turn = 2;
  match.game.wizards = match.game.wizards.filter(w => positions[w.id]);
  for (const w of match.game.wizards) w.pos = { x: positions[w.id][0], y: positions[w.id][1] };
  return match;
}
function onlyLoops() {
  const match = position({
    'red:illusionist': [0, 1], 'red:teleporter': [1, 0], 'red:aeromancer': [2, 1], 'red:spellsword': [1, 2],
    'blue:enchanter': [1, 1], 'blue:spellsword': [0, 2], 'blue:illusionist': [2, 0], 'blue:aeromancer': [2, 2],
    'blue:teleporter': [3, 1], 'blue:pyromancer': [1, 3], 'blue:geomancer': [8, 8], 'blue:electromancer': [9, 9],
  });
  match.game.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 0, y: 0 } }];
  return readMatch(match);
}
const command = (id: string, wizardId = 'red:aeromancer', to: Point = { x: 5, y: 8 }): Command => ({
  id, actor: 'red', at: '2026-11-09T12:00:00.000Z', action: { kind: 'activate', finishTurn: true, activation: { wizardId, before: [to], after: [] } },
});

describe('Regressioni dell’obbligo di attività', () => {
  it('consente di concludere se l’unico mago capace di agire è già stato attivato senza effetti', () => {
    const match = readMatch(position({
      'red:illusionist': [0, 0], 'red:teleporter': [9, 0], 'red:enchanter': [0, 9], 'red:aeromancer': [9, 9],
      'blue:geomancer': [1, 0], 'blue:spellsword': [0, 1], 'blue:illusionist': [8, 0], 'blue:aeromancer': [9, 1],
      'blue:enchanter': [0, 8], 'blue:pyromancer': [1, 9], 'blue:teleporter': [8, 9], 'blue:electromancer': [9, 8],
    }));
    expect(hasActivity(match.game)).toBe(true);
    const next = commitActivation(match, { wizardId: 'red:aeromancer', before: [], after: [] });
    expect(hasActivity(next.game)).toBe(false);
    const finished = applyGameAction(next, { kind: 'skip', finishTurn: true });
    expect(finished.game.active).toBe('blue');
    expect(readMatch(finished)).toEqual(finished);
  });
  it('richiede attività anche quando si può soltanto attraversare un alleato e tornare all’origine', () => {
    const match = onlyLoops();
    expect(hasActivity(match.game)).toBe(true);
    expect(() => endTurn(match.game)).toThrow('almeno');
    expect(() => skipPhase({ ...match.game, phase: 1 })).toThrow('Almeno');
    const moved = activate(match.game, { wizardId: 'red:illusionist', before: [{ x: 0, y: 0 }, { x: 0, y: 1 }], after: [] });
    expect(moved.activity).toBe(true);
    expect(endTurn(moved).active).toBe('blue');
  });
  it('il computer trova il percorso di andata e ritorno anziché fermarsi o passare', () => {
    const match = onlyLoops(), decision = didactic.choose(match.game);
    expect(decision.command.kind).toBe('activate');
    const moved = applyComputerCommand(match.game, decision.command);
    expect(moved.activity).toBe(true);
    expect(readMatch({ ...match, game: moved })).toBeDefined();
  });
  it('mantiene leggibili le vecchie attivazioni vuote senza permetterne di nuove', () => {
    const match = onlyLoops(); match.game.phase = 1;
    const action = { wizardId: 'red:illusionist', before: [], after: [] };
    expect(() => commitActivation(match, action)).toThrow('Almeno');
    const archive = commitActivation(match, action, true);
    expect(readMatch(JSON.parse(JSON.stringify(archive)))).toEqual(archive);
    const journal = { version: 1 as const, roomId: match.game.id, initial: match, events: [{ id: 'old-pass', actor: 'red' as const, at: command('x').at, action: { kind: 'skip' as const } }] };
    expect(replay(journal).game.phase).toBe(2);
    expect(() => append({ ...journal, events: [] }, journal.events[0])).toThrow('Almeno');
  });
});

describe('Regressioni dei backup e del campo condiviso', () => {
  it('la compatibilità storica non autorizza turni iniziali vuoti quando muovere era possibile anche prima', () => {
    const { journal } = makeSession('Ada');
    const event = { id: 'invalid-pass', actor: 'red', at: command('x').at, action: { kind: 'skip' } };
    expect(() => readJournal({ ...journal, events: [event] })).toThrow('Almeno');
  });
  it.each(['standard', 'custom'] as const)('accetta i campi iniziali legittimi con schieramento %s', placement => {
    for (const walls of ['standard', 'varied'] as const) for (const hp of [3, 4, 5] as const) {
      const record = makeSession('Ada', undefined, { ...defaultOptions, placement, walls, hp });
      expect(readJournal(record.journal)).toEqual(record.journal);
    }
  });
  it.each(['turn', 'position', 'activation', 'activity', 'restrained', 'stage'])('rifiuta l’alterazione iniziale %s', field => {
    const record = makeSession('Ada'), game = record.journal.initial!.game;
    if (field === 'turn') game.active = 'blue';
    if (field === 'position') game.wizards[0].pos = { x: 0, y: 1 };
    if (field === 'activation') game.activated = ['red:aeromancer'];
    if (field === 'activity') game.activity = true;
    if (field === 'restrained') game.wizards[0].restrainedUntil = 1;
    if (field === 'stage') game.options.placement = 'custom';
    expect(() => readJournal(record.journal)).toThrow();
  });
  it.each([false, true])('rifiuta prima della scrittura una richiesta incompatibile con il backup più recente (invertiti: %s)', reverse => {
    const old = makeSession('Ada'), backup = structuredClone(old);
    old.outbox = { command: command('pending-A'), base: fingerprint(old.journal) };
    backup.journal = append(backup.journal, command('confirmed-B', 'red:geomancer', { x: 2, y: 8 }));
    const before = JSON.stringify([old, backup]);
    expect(() => reverse ? mergeImportedSession(old, backup) : mergeImportedSession(backup, old)).toThrow('richiesta in sospeso');
    expect(JSON.stringify([old, backup])).toBe(before);
    // Existing inconsistent records remain readable/exportable rather than disappearing from storage.
    expect(readSession({ ...old, journal: backup.journal }).outbox).toEqual(old.outbox);
  });
  it('conserva una richiesta applicabile e rimuove solo una conferma esattamente identica', () => {
    const old = makeSession('Ada'), backup = structuredClone(old);
    old.outbox = { command: command('pending'), base: fingerprint(old.journal) };
    expect(mergeImportedSession(backup, old).outbox).toEqual(old.outbox);
    backup.journal = append(backup.journal, old.outbox.command);
    expect(mergeImportedSession(backup, old).outbox).toBeNull();
    backup.journal = append(old.journal, command('pending', 'red:geomancer', { x: 2, y: 8 }));
    expect(() => mergeImportedSession(backup, old)).toThrow('Identificativo duplicato');
  });
  it('rifiuta una preparazione che contraddice una richiesta ancora in attesa', () => {
    const old = makeSession('Ada'), backup = structuredClone(old);
    old.outbox = { command: command('pending-A'), base: fingerprint(old.journal) };
    backup.prepared = append(backup.journal, command('prepared-B', 'red:geomancer', { x: 2, y: 8 }));
    expect(() => mergeImportedSession(backup, old)).toThrow('richiesta in sospeso');
  });
});
