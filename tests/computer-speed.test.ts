import { expect, it } from 'vitest';
import { newMatch, defaultOptions, type ComputerSpeed, type Match } from '../src/engine/game';
import { computerDelay, setComputerSpeed } from '../src/ai/speed';
import { importMatch } from '../src/engine/backup';

it('salva la velocità senza cambiare stato di gioco o possibilità di annullamento', () => {
  const original: Match = { ...newMatch(), computer: { profile: 'didactic-v1', side: 'both' } };
  original.undo = [structuredClone(original.game)];
  const frozen = structuredClone(original), next = setComputerSpeed(original, 'fast');
  expect(original).toEqual(frozen);
  expect(next.game).toBe(original.game); expect(next.undo).toBe(original.undo);
  expect(next.revision).toBe(original.revision + 1);
  expect(next.computer?.speed).toBe('fast');
  expect(importMatch(JSON.stringify(next))).toEqual(next);
});
it('mantiene leggibili i salvataggi precedenti e lascia invariati i tempi delle altre modalità', () => {
  const old: Match = { ...newMatch(), computer: { profile: 'didactic-v1', side: 'both' } };
  expect(importMatch(JSON.stringify(old))).toEqual(old); expect(computerDelay(old)).toBe(650);
  const single: Match = { ...newMatch({ ...defaultOptions, placement: 'custom' }), computer: { profile: 'didactic-v1', side: 'red' } };
  expect(computerDelay(single)).toBe(350);
  expect(() => setComputerSpeed(single, 'instant')).toThrow('modalità');
});
it('Massima elimina l’attesa e i livelli lenti consentono di osservare ogni fase', () => {
  const original: Match = { ...newMatch({ ...defaultOptions, placement: 'custom' }), computer: { profile: 'didactic-v1', side: 'both' } };
  expect(computerDelay(setComputerSpeed(original, 'instant'))).toBe(0);
  expect(computerDelay(setComputerSpeed(original, 'slowest'))).toBe(5000);
  const playing = structuredClone(original); playing.game.stage = 'playing';
  expect(computerDelay(setComputerSpeed(playing, 'slowest'))).toBe(5000);
});
it('rifiuta velocità sconosciute o corrotte nei comandi e nei backup', () => {
  const original: Match = { ...newMatch(), computer: { profile: 'didactic-v1', side: 'both' } };
  for (const invalid of ['turbo', -1, null, {}]) {
    expect(() => setComputerSpeed(original, invalid as ComputerSpeed)).toThrow('Velocità');
    expect(() => importMatch(JSON.stringify({ ...original, computer: { ...original.computer, speed: invalid } }))).toThrow('Velocità');
  }
});
