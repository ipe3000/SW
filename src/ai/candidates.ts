import { activate, at, canEnter, charmed, copyAt, empty, isWall, previewActivation, speed, targetPoints, teleportDestinations, wizard, type Activation, type Game, type Point, type Side, type Spell, type Wizard } from '../engine/game';
import { adjacent, distance, key } from '../engine/geometry';

export type Path = { position: Point; steps: Point[] };
/** One shortest path per endpoint. Friendly pieces may be crossed, never occupied. */
export function movementPaths(game: Game, origin: Point, maximum: number, side: Side, ignoreId?: string, copyOwner?: string, anchor?: Point, forced = false): Path[] {
  const queue: Path[] = [{ position: origin, steps: [] }], seen = new Set([key(origin)]), result: Path[] = [];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (!isWall(game, current.position) && !at(game, current.position, ignoreId) && !copyAt(game, current.position, copyOwner)) result.push(current);
    if (current.steps.length >= maximum) continue;
    for (const next of adjacent(current.position)) {
      if (seen.has(key(next)) || anchor && distance(anchor, next) > 3) continue;
      if (forced ? !empty(game, next, ignoreId) : !canEnter(game, next, side, ignoreId, copyOwner)) continue;
      seen.add(key(next)); queue.push({ position: next, steps: [...current.steps, next] });
    }
  }
  // A wizard boxed in by friendly pieces can still spend movement by going out and back.
  if (!forced && ignoreId && !copyOwner && maximum >= 2 && result.length === 1 && !result[0].steps.length) {
    const via = adjacent(origin).find(p => canEnter(game, p, side, ignoreId));
    if (via) result.push({ position: origin, steps: [via, origin] });
  }
  return result;
}

/** Spell proposals are validated by activate() before they can be selected. */
export function* spellCandidates(game: Game, caster: Wizard): Generator<Spell> {
  if (!caster.pos) return;
  switch (caster.kind) {
    case 'electromancer':
      if (targetPoints(game, caster).length) yield { kind: 'lightning' };
      return;
    case 'enchanter': case 'geomancer': case 'spellsword':
      for (const point of targetPoints(game, caster)) yield { kind: caster.kind === 'enchanter' ? 'touch' : caster.kind === 'geomancer' ? 'earth' : 'sword', targetId: at(game, point)!.id };
      return;
    case 'pyromancer':
      for (const center of targetPoints(game, caster)) yield { kind: 'fireball', center };
      return;
    case 'aeromancer':
      for (const point of targetPoints(game, caster)) {
        const target = at(game, point)!;
        if (target.side !== caster.side && target.hp === 1) { yield { kind: 'wind', targetId: target.id, path: [] }; continue; }
        for (const path of movementPaths(game, point, 2, target.side, target.id, undefined, undefined, true)) {
          if (target.side !== caster.side || path.steps.length) yield { kind: 'wind', targetId: target.id, path: path.steps };
        }
      }
      return;
    case 'teleporter':
      for (const point of targetPoints(game, caster)) for (const destination of teleportDestinations(game, caster)) yield { kind: 'teleport', targetId: at(game, point)!.id, destination };
      return;
    case 'illusionist': {
      const existing = game.copies.find(c => c.ownerId === caster.id);
      if (existing && distance(existing.pos, caster.pos) > 3) return;
      const origins = existing ? [existing.pos] : adjacent(caster.pos).filter(p => empty(game, p));
      const emitted = new Set<string>();
      for (const origin of origins) {
        for (const route of movementPaths(game, origin, 3, caster.side, undefined, caster.id, caster.pos)) {
          const targets = game.wizards.filter(w => w.side !== caster.side && w.pos && distance(w.pos, route.position) === 1);
          for (const target of [undefined, ...targets]) {
            if (existing && !route.steps.length && !target) continue;
            const signature = `${key(route.position)}:${target?.id ?? ''}`;
            if (emitted.has(signature)) continue;
            emitted.add(signature);
            yield { kind: 'illusion', ...(existing ? {} : { summon: origin }), path: route.steps, ...(target ? { targetId: target.id } : {}) };
          }
        }
      }
    }
  }
}

export type Candidate = { activation: Activation; game: Game };
/** Explore movement before an action, including the option to act immediately. */
export function* activationSeeds(base: Game, onlyWizard?: string): Generator<Candidate> {
  if (base.stage !== 'playing' || base.pending || base.phase >= 3) return;
  for (const initial of base.wizards) {
    if (initial.side !== base.active || !initial.pos || base.activated.includes(initial.id) || onlyWizard && initial.id !== onlyWizard) continue;
    const mayCast = base.phase < 2 && !charmed(base, initial);
    for (const path of movementPaths(base, initial.pos, speed(base, initial), initial.side, initial.id)) {
      const activation: Activation = { wizardId: initial.id, before: path.steps, after: [] };
      if (path.steps.length) {
        try { yield { activation, game: activate(base, activation) }; } catch { /* Shared rules reject illegal candidates. */ }
      }
      if (!mayCast) continue;
      const atCast = previewActivation(base, activation).game, caster = wizard(atCast, initial.id)!;
      for (const spell of spellCandidates(atCast, caster)) {
        const action = { ...activation, spell };
        try { yield { activation: action, game: activate(base, action) }; } catch { /* Includes abilities with no final effect. */ }
      }
    }
  }
}
