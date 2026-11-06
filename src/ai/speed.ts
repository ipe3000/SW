import type { ComputerSpeed, Match } from '../engine/game';

export const COMPUTER_SPEEDS: readonly { id: ComputerSpeed; label: string; delayMs: number }[] = [
  { id: 'slowest', label: 'Molto lenta · 5 s', delayMs: 5000 },
  { id: 'slow', label: 'Lenta · 2 s', delayMs: 2000 },
  { id: 'normal', label: 'Normale · 0,65 s', delayMs: 650 },
  { id: 'fast', label: 'Veloce · 0,2 s', delayMs: 200 },
  { id: 'instant', label: 'Massima · senza attesa', delayMs: 0 }
];
export const isComputerSpeed = (value: unknown): value is ComputerSpeed => COMPUTER_SPEEDS.some(option => option.id === value);
export function computerDelay(match: Match): number {
  if (match.computer?.side === 'both' || match.computer?.speed !== undefined) return COMPUTER_SPEEDS.find(option => option.id === (match.computer?.speed ?? 'normal'))!.delayMs;
  return match.game.stage === 'deployment' ? 350 : 650;
}
export function setComputerSpeed(match: Match, speed: ComputerSpeed): Match {
  if (match.computer?.side !== 'both' || !isComputerSpeed(speed)) throw new Error('Velocità non valida per questa modalità.');
  return { ...match, computer: { ...match.computer, speed }, revision: match.revision + 1, savedAt: new Date().toISOString() };
}
