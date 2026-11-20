import { wizard, type Activation, type Game } from '../../../src/engine/game';
import { distance } from '../../../src/engine/geometry';

/** Preserve distinct purposes, including different targets of the same support spell. */
export function tacticalFamily(base: Game, activation: Activation, next: Game): string {
  const spell = activation.spell, prefix = activation.wizardId;
  if (!spell) return `${prefix}:move`;
  const killed = base.wizards.filter(w => w.side !== base.active && !wizard(next, w.id));
  if (killed.length) return `${prefix}:kill:${killed.map(w => w.id).sort().join(',')}`;
  if ('targetId' in spell && spell.targetId) {
    const target = wizard(base, spell.targetId);
    return `${prefix}:${target?.side === base.active ? 'support' : 'attack'}:${spell.targetId}`;
  }
  return `${prefix}:${spell.kind}`;
}

export function diverseMoves<T>(moves: T[], width: number, family: (move: T) => string): T[] {
  const result = moves.slice(0, Math.max(1, Math.ceil(width / 2)));
  const families = new Set(result.map(family));
  for (const move of moves) {
    if (result.length >= width) break;
    if (!families.has(family(move))) { result.push(move); families.add(family(move)); }
  }
  for (const move of moves) {
    if (result.length >= width) break;
    if (!result.includes(move)) result.push(move);
  }
  return result;
}

/** Normal completes tactical enemy replies as well, including preparations without damage. */
export function needsFullReply(game: Game): boolean {
  return game.wizards.some(w => w.restrainedUntil !== undefined) ||
    game.wizards.some(w => w.pos && game.wizards.some(e => e.side !== w.side && e.pos && distance(w.pos!, e.pos) <= 4));
}

/** Bounded long-term reinforcement value; a distant piece still benefits from one step.
 * Distances come from terrain paths, not the geometric board centre. */
export function reinforcementValue(kind: string, separation: number): number {
  const reach = kind === 'illusionist' ? 4 : kind === 'aeromancer' || kind === 'geomancer' || kind === 'pyromancer' ? 3 : kind === 'teleporter' ? 2 : 1;
  const remaining = Math.max(0, separation - reach);
  return -.6 * remaining / (1 + remaining / 16);
}
