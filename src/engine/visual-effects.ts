import { adjacent, distance, same, type Point } from './geometry';
import { wizard, type Game, type ResolutionEvent, type Spell, type Wizard } from './game';

export type VisualEffect = { kind: 'wind' | 'lightning' | 'fireball' | 'sword' | 'touch' | 'earth' | 'teleport' | 'summon' | 'illusion' | 'dissolve' | 'release' | 'undo'; points: Point[]; origin?: Point; links?: [Point, Point][]; impact?: boolean };
export type VisualGhost = { wizard: Wizard; copy?: boolean; departing?: boolean };
/** Presentation metadata only. No saved state or game rules are changed. */
export function spellVisual(game: Game, actorId: string, spell: Spell): VisualEffect {
  const origin = wizard(game, actorId)!.pos!, target = 'targetId' in spell && spell.targetId ? wizard(game, spell.targetId)?.pos : undefined;
  if (spell.kind === 'lightning') {
    const all = [origin], seen = new Set([actorId]);
    for (let i = 0; i < all.length; i++) for (const w of game.wizards) if (w.pos && !seen.has(w.id) && distance(all[i], w.pos) === 1) { seen.add(w.id); all.push(w.pos); }
    const links: [Point, Point][] = [];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (distance(all[i], all[j]) === 1) links.push([all[i], all[j]]);
    return { kind: 'lightning', origin, points: all.slice(1), links };
  }
  if (spell.kind === 'fireball') return { kind: 'fireball', origin, points: [spell.center, ...adjacent(spell.center)] };
  if (spell.kind === 'teleport') return { kind: 'teleport', points: target ? [target, spell.destination] : [spell.destination] };
  if (spell.kind === 'illusion') return { kind: spell.summon ? 'summon' : 'illusion', origin, points: spell.summon ? [spell.summon] : game.copies.filter(c => c.ownerId === actorId).map(c => c.pos) };
  return { kind: spell.kind, origin, points: target ? [target] : [] };
}
export function eventVisuals(event: ResolutionEvent, spell: VisualEffect | undefined, previous: Game): VisualEffect[] {
  if (event.kind === 'ability') return spell ? [spell] : [];
  if (event.kind === 'damage' && spell && !['summon', 'illusion'].includes(spell.kind)) return [{ ...spell, impact: true }];
  if (event.kind === 'teleport') return [{ kind: 'teleport', points: event.points ?? [], impact: true }];
  if (event.kind === 'restrain') return [{ kind: 'earth', points: event.points ?? [], impact: true }];
  if (event.kind === 'copy' && !event.path) return [{ kind: 'summon', points: event.points ?? [], impact: true }];
  if (event.kind === 'removed') return (event.effects ?? []).filter(e => e.kind === 'copy' && e.at).map(e => ({ kind: 'dissolve' as const, points: [e.at!], origin: e.wizardId ? wizard(previous, e.wizardId)?.pos ?? undefined : undefined }));
  return [];
}
export function removedGhosts(previous: Game, event: ResolutionEvent): VisualGhost[] {
  if (event.kind === 'teleport') {
    const old = wizard(previous, event.actorId); return old?.pos ? [{ wizard: structuredClone(old), departing: true }] : [];
  }
  if (event.kind !== 'removed') return [];
  return (event.effects ?? []).flatMap<VisualGhost>(effect => {
    if (effect.kind === 'removed') { const old = wizard(previous, effect.wizardId!); return old ? [{ wizard: structuredClone(old) }] : []; }
    if (effect.kind === 'copy' && effect.at) {
      const copy = previous.copies.find(c => same(c.pos, effect.at!)), owner = copy && wizard(previous, copy.ownerId);
      return owner ? [{ wizard: { ...structuredClone(owner), pos: effect.at }, copy: true }] : [];
    }
    return [];
  });
}
