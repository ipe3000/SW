import { distance } from '../engine/geometry';
import type { ComputerDifficulty, Game } from '../engine/game';

/** A conservative opening phase, never inferred from presentation logs or saved history. */
export function quietOpening(game: Game): boolean {
  if (game.stage !== 'playing' || game.pending || game.result || game.wizards.length !== 16) return false;
  if (game.wizards.some(w => !w.pos || w.hp !== game.options.hp || w.restrainedUntil !== undefined)) return false;
  const red = game.wizards.filter(w => w.side === 'red'), blue = game.wizards.filter(w => w.side === 'blue');
  if (red.length !== 8 || blue.length !== 8) return false;
  // Four covers stationary damage reach, including a controlled illusion copy.
  // Ignore walls here: treating blocked nearby enemies as tactical is the conservative choice.
  return red.every(a => blue.every(b => distance(a.pos!, b.pos!) > 4));
}

export function openingTimeScale(game: Game, difficulty: ComputerDifficulty): number {
  return difficulty === 'hard' && quietOpening(game) ? .85 : 1;
}
