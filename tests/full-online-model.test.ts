import { describe, expect, it } from 'vitest';
import { append, backupText, fingerprint, makeSession, readBackup, readJournal, readSession, reconcile, replay, type Command } from '../src/network/model';
import { defaultOptions } from '../src/engine/game';
import { readGameAction, type GameAction } from '../src/engine/commands';
import { didactic } from '../src/ai/didactic';
import { mergeImportedSession } from '../src/network/storage';

const event = (action: GameAction, id: string, actor: 'red' | 'blue' = 'red'): Command => ({ id, actor, at: '2026-11-07T12:00:00.000Z', action });
describe('Cronologia del gioco completo', () => {
  it('l’importazione conserva preparazioni ancora da recuperare e il posto già assegnato', () => {
    const old = makeSession('Ada'), backup = structuredClone(old), guest = makeSession('Bruno', old);
    backup.guestCredential = guest.credential;
    backup.prepared = append(backup.journal, event({ kind: 'activate', activation: { wizardId: 'red:electromancer', before: [{ x: 1, y: 8 }], after: [] } }, 'pending'));
    const imported = mergeImportedSession(backup, old);
    expect(imported.prepared).toEqual(backup.prepared); expect(imported.guestCredential).toBe(guest.credential);
    expect(mergeImportedSession(backup).prepared).toEqual(backup.prepared);
    const committed = { ...backup, journal: backup.prepared, prepared: null };
    expect(mergeImportedSession(old, committed).journal).toEqual(committed.journal);
    expect(mergeImportedSession(old, committed).guestCredential).toBe(guest.credential);
  });
  it('genera una sola volta dadi, muri e schieramento e li conserva nei due backup', () => {
    const host = makeSession('Ada', undefined, { ...defaultOptions, hp: 5, walls: 'varied', placement: 'custom' });
    const guest = makeSession('Bruno', host); guest.journal = reconcile(host.journal, guest.journal);
    expect(replay(guest.journal)).toEqual(replay(host.journal));
    expect(replay(guest.journal).game.wizards.every(w => !w.pos && w.hp === 5)).toBe(true);
    expect(fingerprint(readBackup(backupText(host)).journal)).toBe(fingerprint(guest.journal));
    const placed = append(host.journal, event({ kind: 'place', wizardId: 'red:spellsword', to: { x: 1, y: 9 } }, 'place'));
    const undone = append(placed, event({ kind: 'undo' }, 'undo'));
    expect(replay(undone).game).toEqual(replay(host.journal).game);
    expect(replay(readJournal(placed)).game).toEqual(replay(placed).game);
  });
  it('rifiuta duplicati, gilda errata, percorso illegale e campi iniziali differenti', () => {
    const { journal } = makeSession('Ada');
    const e = event({ kind: 'activate', activation: { wizardId: 'red:electromancer', before: [{ x: 1, y: 8 }], after: [] } }, 'one');
    const next = append(journal, e);
    expect(() => append(next, e)).toThrow('duplicato');
    expect(() => append(journal, { ...e, actor: 'blue' })).toThrow('turno');
    expect(() => append(journal, event({ kind: 'activate', activation: { wizardId: 'red:electromancer', before: [{ x: 1, y: 6 }], after: [] } }, 'jump'))).toThrow();
    const altered = structuredClone(journal); altered.initial!.game.options.hp = 5;
    expect(() => reconcile(journal, altered)).toThrow('divergenti');
    expect(() => readSession({ ...makeSession('Ada'), outbox: { command: { ...e, actor: 'blue' }, base: fingerprint(journal) } })).toThrow('altra gilda');
  });
  it.each([
    { kind: 'wind', targetId: 'blue:geomancer', path: [{ x: 4, y: 4 }] }, { kind: 'lightning' },
    { kind: 'touch', targetId: 'blue:geomancer' }, { kind: 'earth', targetId: 'blue:geomancer' },
    { kind: 'sword', targetId: 'blue:geomancer' }, { kind: 'fireball', center: { x: 3, y: 4 } },
    { kind: 'teleport', targetId: 'blue:geomancer', destination: { x: 3, y: 4 } },
    { kind: 'illusion', summon: { x: 3, y: 4 }, path: [{ x: 3, y: 5 }], targetId: 'blue:geomancer' }
  ])('conserva esattamente le scelte dell’abilità $kind', spell => {
    const action = { kind: 'activate', activation: { wizardId: 'red:geomancer', before: [], spell, after: [] } };
    expect(readGameAction(JSON.parse(JSON.stringify(action)))).toEqual(action);
  });
  it('riproduce una partita intera; soglia provvisoria, blocco, annullamento e conclusione restano identici', () => {
    let journal = makeSession('Ada', undefined, { ...defaultOptions, hp: 3 }).journal;
    for (let i = 0; i < 220; i++) {
      const before = replay(journal), decision = didactic.choose(before.game).command;
      const action: GameAction = decision.kind === 'place' ? { kind: 'place', wizardId: decision.wizardId, to: decision.position } : decision;
      const command = event(action, `ai-${i}`, before.game.active), next = append(journal, command), after = replay(next);
      if (after.game.pending) {
        expect(after.game.stage).toBe('playing');
        expect(replay(readJournal(JSON.parse(JSON.stringify(next))))).toEqual(after);
        expect(() => append(next, event({ kind: 'skip' }, 'forbidden', after.game.active))).toThrow();
        const undo = append(next, event({ kind: 'undo' }, 'undo-result', after.game.active));
        expect(replay(undo).game).toEqual(before.game); expect(replay(undo).game.pending).toBeNull();
        const again = append(undo, { ...command, id: 'same-activation-again' });
        expect(replay(again).game.pending).toEqual(after.game.pending);
        const finished = append(again, event({ kind: 'end-turn' }, 'final', after.game.active));
        expect(replay(finished).game.result).toEqual(after.game.pending);
        expect(replay(readJournal(finished))).toEqual(replay(finished));
        return;
      }
      journal = next;
    }
    throw new Error('Nessuna conclusione nella partita di collaudo');
  }, 60000);
});
