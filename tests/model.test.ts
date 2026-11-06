import { describe, expect, it } from 'vitest';
import { append, backupText, fingerprint, initialState, makeSession, movementPath, readBackup, readJournal, readSession, reconcile, replay, type Command } from '../src/model';

const fresh = () => makeSession('Ada').journal;
const move = (id = 'move1', actor: 'red' | 'blue' = 'red', x = 4, y = 5): Command => ({ id, actor, kind: 'move', to: { x, y } });
describe('Cronologia della prova online', () => {
  it('mostra solo percorsi ortogonali liberi di massimo tre passi', () => {
    const state = initialState();
    expect(movementPath(state, { x: 4, y: 5 })).toHaveLength(4);
    expect(movementPath(state, { x: 4, y: 4 })).toBeNull();
    expect(movementPath(state, { x: 6, y: 5 })).toBeNull();
    expect(movementPath(state, { x: -1, y: 8 })).toBeNull();
    expect(movementPath(state, state.positions.red)).toBeNull();
  });
  it('impedisce di muovere per il giocatore non attivo', () => {
    expect(() => append(fresh(), move('x', 'blue', 5, 2))).toThrow('turno');
  });
  it('annulla a ritroso e chiude gli annullamenti al cambio di turno', () => {
    const base = fresh();
    const one = append(base, move());
    const undone = append(one, { id: 'undo1', actor: 'red', kind: 'undo' });
    expect(replay(undone)).toEqual(initialState());
    const ended = append(one, { id: 'end1', actor: 'red', kind: 'end-turn' });
    expect(replay(ended).active).toBe('blue');
    expect(() => append(ended, { id: 'undo2', actor: 'blue', kind: 'undo' })).toThrow('annullare');
    expect(() => append(base, { id: 'end0', actor: 'red', kind: 'end-turn' })).toThrow('almeno');
  });
  it('limita gli spostamenti senza limitare gli annullamenti consentiti', () => {
    const first = append(fresh(), move());
    const second = append(first, move('move2', 'red', 4, 3));
    expect(() => append(second, move('move3', 'red', 4, 2))).toThrow('due spostamenti');
    const undone = append(second, { id: 'undo', actor: 'red', kind: 'undo' });
    expect(replay(append(undone, move('alternative', 'red', 5, 4))).moves).toBe(2);
  });
  it('rifiuta comandi duplicati anche dopo annullamento', () => {
    const first = append(fresh(), move());
    const undone = append(first, { id: 'undo', actor: 'red', kind: 'undo' });
    expect(() => append(undone, move())).toThrow('duplicato');
  });
  it('normalizza l’ordine delle proprietà per mantenere la stessa impronta nei browser', () => {
    const journal = append(fresh(), { kind: 'move', to: { y: 5, x: 4 }, actor: 'red', id: 'canonical' });
    expect(fingerprint(readJournal(JSON.parse(JSON.stringify(journal))))).toBe(fingerprint(journal));
  });
  it('recupera la cronologia confermata più avanzata, anche da un backup vecchio', () => {
    const old = fresh(); const latest = append(old, move());
    expect(reconcile(old, latest)).toEqual(latest);
    expect(reconcile(latest, old)).toEqual(latest);
  });
  it('blocca due cronologie divergenti senza preferire l’orologio o il numero di eventi', () => {
    const base = fresh();
    const a = append(base, move('a'));
    const b = append(base, move('b', 'red', 3, 8));
    expect(() => reconcile(a, b)).toThrow('divergenti');
  });
  it('non unisce partite diverse', () => {
    expect(() => reconcile(fresh(), fresh())).toThrow('divergenti');
  });
});
describe('Backup personali', () => {
  it('preserva posto, accesso e cronologia verificata', () => {
    const record = makeSession('Ada'); record.journal = append(record.journal, move());
    expect(readBackup(backupText(record))).toEqual(record);
  });
  it('rifiuta formati, versioni e coordinate non validi', () => {
    expect(() => readBackup('{')).toThrow('leggibile');
    expect(() => readBackup('{"format":"altro","version":1}')).toThrow('Formato');
    const record = makeSession('Ada');
    expect(() => readSession({ ...record, version: 2 })).toThrow('compatibile');
    expect(() => readJournal({ ...record.journal, events: [move('x', 'red', 100, 5)] })).toThrow('Casella');
    expect(() => readJournal({ ...record.journal, events: [move('x', 'red', 4, 1)] })).toThrow('tre passi');
  });
  it('ammette solo una modifica preparata che estende la cronologia', () => {
    const record = makeSession('Ada');
    const prepared = append(record.journal, move());
    expect(readSession({ ...record, prepared }).prepared).toEqual(prepared);
    expect(() => readSession({ ...record, prepared: append(prepared, move('two', 'red', 4, 3)) })).toThrow('non coerente');
  });
});
