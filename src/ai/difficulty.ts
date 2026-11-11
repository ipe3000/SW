import type { ComputerDifficulty, Match, Side } from '../engine/game';

export const difficultyLabels: Record<ComputerDifficulty, string> = {
  easy: 'Facile',
  normal: 'Normale',
  hard: 'Difficile'
};

export function computerDifficulty(match: Match, side: Side = match.game.active): ComputerDifficulty {
  return match.computer?.difficulty?.[side] ?? 'normal';
}
