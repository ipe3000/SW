import type { ComputerDifficulty, Match, Side } from '../engine/game';

export const DEFAULT_COMPUTER_DIFFICULTY: ComputerDifficulty = 'easy';

export const difficultyLabels: Record<ComputerDifficulty, string> = {
  easy: 'Facile',
  normal: 'Normale',
  hard: 'Difficile'
};

export function computerDifficulty(match: Match, side: Side = match.game.active): ComputerDifficulty {
  return match.computer?.difficulty?.[side] ?? DEFAULT_COMPUTER_DIFFICULTY;
}
