import { activate, charmed, deploymentInfo, empty, hasSight, INFO, lightningTargets, placeWizard, skipPhase, speed, wizard, type Activation, type Game, type Point, type Wizard } from '../engine/game';
import { adjacent, distance, key } from '../engine/geometry';
import { activationSeeds, movementPaths, type Candidate } from './candidates';
import type { ComputerDecision, ComputerPlayer } from './types';
import { quietOpening } from './opening-pace';

type Scored = Candidate & { score: number };
const squareIndex = (p: Point) => p.y * 10 + p.x;

/** Distances around walls guide approach; no search or game rule depends on UI. */
function terrain(game: Game): Uint8Array[] {
  const walls = new Set(game.walls.map(key));
  return Array.from({ length: 100 }, (_, start) => {
    const distances = new Uint8Array(100).fill(100), queue = [{ x: start % 10, y: Math.floor(start / 10) }]; distances[start] = 0;
    for (let i = 0; i < queue.length; i++) for (const p of adjacent(queue[i])) {
      if (walls.has(key(p)) || distances[squareIndex(p)] !== 100) continue;
      distances[squareIndex(p)] = distances[squareIndex(queue[i])] + 1; queue.push(p);
    }
    return distances;
  });
}
function approximateDamage(game: Game, enemy: Wizard, target: Wizard, blocked: boolean, paths?: Uint8Array[]): number {
  if (!enemy.pos || !target.pos || blocked || enemy.kind === 'teleporter') return 0;
  const from = enemy.kind === 'illusionist' ? game.copies.find(c => c.ownerId === enemy.id)?.pos ?? enemy.pos : enemy.pos;
  if (enemy.kind === 'illusionist' && distance(from, enemy.pos) > 3) return 0;
  const d = distance(from, target.pos), reach = enemy.kind === 'pyromancer' ? 3 : enemy.kind === 'illusionist' ? 4 : enemy.kind === 'electromancer' ? 1 : INFO[enemy.kind].range;
  const amount = enemy.kind === 'spellsword' ? 2 : 1;
  if (d <= reach && (enemy.kind === 'pyromancer' || enemy.kind === 'illusionist' || hasSight(game, from, target.pos, enemy.side))) return amount;
  if (!paths) return enemy.restrainedUntil === undefined && d <= reach + INFO[enemy.kind].speed ? amount * .12 : 0;
  // A reachable attack after movement is a real threat. Wall detours prevent false danger through solid barriers.
  const separation = paths[squareIndex(from)][squareIndex(target.pos)];
  const mobile = enemy.restrainedUntil === undefined && !(game.active === enemy.side &&
    (game.phase >= 2 || game.activated.includes(enemy.id)));
  return mobile && separation <= reach + INFO[enemy.kind].speed ? amount * .55 : 0;
}
const fireCenters = Array.from({ length: 100 }, (_, index) => {
  const origin = { x: index % 10, y: Math.floor(index / 10) };
  return Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) }))
    .filter(point => distance(origin, point) <= INFO.pyromancer.range);
});

export function areaOpportunity(game: Game, caster: Wizard, enemies: Wizard[]): number {
  if (!caster.pos || charmed(game, caster)) return 0;
  if (caster.kind === 'electromancer') {
    return Math.max(0, lightningTargets(game, caster).reduce((sum, target) =>
      sum + (target.side === caster.side ? -1 : 1) * (target.hp === 1 ? 2 : 1), 0) - 1);
  }
  if (caster.kind !== 'pyromancer') return 0;
  let best = 0;
  for (const center of fireCenters[squareIndex(caster.pos)]) {
    const impact = enemies.reduce((sum, target) =>
      sum + (target.pos && distance(target.pos, center) <= 1 ? target.hp === 1 ? 2 : 1 : 0), 0);
    if (impact > best && !game.walls.some(wall => distance(wall, center) === 0) &&
        hasSight(game, caster.pos, center, caster.side)) best = impact;
  }
  return Math.max(0, best - 1);
}

export function evaluator(base: Game, tactical = false, developOpening = false) {
  const paths = terrain(base), perspective = base.active;
  // Opt-in at the search root only. Keep the term continuous when a searched line
  // reaches contact: dropping it at that boundary would reward staying distant.
  const develop = developOpening && quietOpening(base);
  return (game: Game): number => {
    const outcome = game.pending ?? game.result;
    if (outcome) return outcome.winner === perspective ? 1_000_000 : -1_000_000;
    const blocked = new Map(game.wizards.map(w => [w.id, charmed(game, w)]));
    const counts = { red: game.wizards.filter(w => w.side === 'red' && w.pos).length, blue: game.wizards.filter(w => w.side === 'blue' && w.pos).length };
    let score = 0;
    // Losing the fifth mage is much worse than losing one of eight: HP cannot replace a survivor.
    score += 65 * (Math.log(Math.max(1, counts[perspective] - 3)) - Math.log(Math.max(1, counts[perspective === 'red' ? 'blue' : 'red'] - 3)));
    for (const w of game.wizards) {
      if (!w.pos) continue;
      const enemies = game.wizards.filter(e => e.side !== w.side && e.pos);
      const nearest = Math.min(30, ...enemies.map(e => paths[squareIndex(w.pos!)][squareIndex(e.pos!)]));
      const incoming = enemies.map(e => ({ pressure: approximateDamage(game, e, w, blocked.get(e.id)!, tactical ? paths : undefined), damage: e.kind === 'spellsword' ? 2 : 1 }));
      const hits = incoming.map(hit => hit.pressure).sort((a, b) => b - a);
      const danger = (hits[0] ?? 0) + (hits[1] ?? 0);
      const mortality = counts[w.side] <= 4 ? 4 : counts[w.side] === 5 ? 2.2 : 1;
      const potential = incoming.filter(hit => hit.pressure > 0).map(hit => hit.damage).sort((a,b) => b-a);
      const lethal = danger >= w.hp || tactical && (potential[0] ?? 0) + (potential[1] ?? 0) >= w.hp;
      const risk = danger * 1.5 + (lethal ? (12 + (5 - w.hp) * 2) * mortality : 0);
      const centre = Math.abs(w.pos.x - 4.5) + Math.abs(w.pos.y - 4.5);
      const charm = w.kind === 'enchanter' ? enemies.filter(e => distance(w.pos!, e.pos!) === 1).length * 1.8 : 0;
      // A small initiative bias shared by every level: seek contact and slightly prefer dealing
      // damage in otherwise comparable exchanges. Keep lethal danger and lost-mage penalties intact.
      const friendly = w.side === perspective;
      const healthWeight = friendly ? 12 : 13.5;
      const approachWeight = friendly ? .8 : .65;
      let value = 85 + w.hp * healthWeight - nearest * approachWeight - centre * .035 - risk + charm - (w.restrainedUntil !== undefined ? 2 : 0);
      if (tactical) {
        const ready = game.active === w.side && game.phase < 2 && !game.activated.includes(w.id);
        value += areaOpportunity(game, w, enemies) * (ready ? 7 : 3);
        if (w.kind === 'pyromancer' && !blocked.get(w.id)) {
          // Estimate reachable fire crosses before searching exact legal spells. Include movement,
          // multiple victims and fragile targets, rather than only the nearest individual enemy.
          const centers = new Map<string,Point>();
          for (const enemy of enemies) for (const center of [enemy.pos!,...adjacent(enemy.pos!)]) centers.set(key(center),center);
          let exposure=0;
          for (const center of centers.values()) {
            const travel=Math.max(0,paths[squareIndex(w.pos)][squareIndex(center)]-INFO.pyromancer.range);
            if (travel>(w.restrainedUntil===undefined?INFO.pyromancer.speed:0) || game.walls.some(wall=>key(wall)===key(center))) continue;
            const victims=enemies.filter(enemy=>distance(enemy.pos!,center)<=1);
            if(victims.length<2) continue;
            exposure=Math.max(exposure,((victims.length-1)*5+victims.filter(enemy=>enemy.hp===1).length*3)*(1-travel*.12));
          }
          value+=exposure;
        }
        if (blocked.get(w.id) || w.restrainedUntil !== undefined) {
          const denied = enemies.reduce((best, target) => {
            const range = w.kind === 'pyromancer' ? INFO.pyromancer.range + 1 : Math.max(1, INFO[w.kind].range);
            const separation = paths[squareIndex(w.pos!)][squareIndex(target.pos!)];
            const attack = approximateDamage(game, w, target, false);
            const threatened = (blocked.get(w.id) && attack >= 1) ||
              (w.restrainedUntil !== undefined && attack < 1 && separation > range && separation <= range + INFO[w.kind].speed);
            return threatened && w.kind !== 'teleporter'
              ? Math.max(best, target.hp <= (w.kind === 'spellsword' ? 2 : 1) ? 13 : 6) : best;
          }, 0);
          value -= denied;
        }
      }
      score += (w.side === perspective ? 1 : -1) * value;
    }
    for (const copy of game.copies) {
      const owner = wizard(game, copy.ownerId)!;
      const nearest = Math.min(20, ...game.wizards.filter(w => w.side !== copy.side && w.pos).map(w => distance(copy.pos, w.pos!)));
      const value = owner?.pos && distance(owner.pos, copy.pos) <= 3 ? 5 - nearest * .15 : .5;
      score += (copy.side === perspective ? 1 : -1) * value;
    }
    if (develop) {
      const enemies = game.wizards.filter(w => w.side !== perspective && w.pos);
      const developed = game.wizards.filter(w => w.side === perspective && w.pos && w.kind !== 'teleporter')
        .map(w => {
          const nearest = Math.min(30, ...enemies.map(e => paths[squareIndex(w.pos!)][squareIndex(e.pos!)]));
          return Math.max(0, Math.min(5, 9 - nearest));
        }).sort((a, b) => b - a);
      // At most 6.75 points for three attackers; one enemy HP is worth 13.5.
      // Rearranging copies or a teleporter alone earns no extra development.
      score += developed.slice(0, 3).reduce((sum, progress) => sum + progress, 0) * .45;
    }
    return score;
  };
}
export function tieBreak(game: Game, activation: Activation): number {
  let hash = game.turn * 31 + game.phase;
  for (const char of JSON.stringify(activation)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296 * .01 - (activation.before.length + activation.after.length) * .015;
}

/** Shallow, bounded lookahead: immediate effects, position and simple danger. */
export const didactic: ComputerPlayer = {
  id: 'didactic-v1',
  choose(input: Game): ComputerDecision {
    if (input.stage === 'finished') throw new Error('La partita è già conclusa.');
    if (input.stage === 'deployment') {
      const [side] = deploymentInfo(input), roster = input.wizards.filter(w => w.side === side), selected = roster.find(w => !w.pos);
      if (!selected) throw new Error('Non ci sono maghi da schierare.');
      const preferred = roster.indexOf(selected) + 1, row = side === 'red' ? 9 : 0;
      const position = Array.from({ length: 8 }, (_, i) => ({ x: i + 1, y: row })).filter(p => empty(input, p)).sort((a, b) => Math.abs(a.x - preferred) - Math.abs(b.x - preferred))[0];
      if (!position) throw new Error('Non ci sono caselle di schieramento disponibili.');
      placeWizard(input, selected.id, position);
      return { command: { kind: 'place', wizardId: selected.id, position }, evaluated: 1 };
    }
    if (input.pending || input.phase >= 3) return { command: { kind: 'end-turn' }, evaluated: 0 };
    // Search snapshots need no presentation history. Real commits preserve the full log.
    const base = { ...input, log: [] }, evaluate = evaluator(base), followUps = new Map<string, Scored[]>();
    let best: Scored | null = null, evaluated = 0;
    function consider(candidate: Candidate): Scored {
      evaluated++;
      const scored = { ...candidate, score: evaluate(candidate.game) + tieBreak(base, candidate.activation) };
      if (!best || scored.score > best.score) best = scored;
      return scored;
    }
    for (const candidate of activationSeeds(base)) {
      const scored = consider(candidate), initial = wizard(base, candidate.activation.wizardId)!;
      if (!candidate.activation.spell || candidate.game.pending || candidate.activation.before.length >= speed(base, initial)) continue;
      const shortlist = followUps.get(initial.id) ?? [];
      shortlist.push(scored); shortlist.sort((a, b) => b.score - a.score); shortlist.length = Math.min(shortlist.length, 8); followUps.set(initial.id, shortlist);
    }
    for (const candidate of afterSpellCandidates(base, [...followUps.values()].flat())) consider(candidate);
    if (best) return { command: { kind: 'activate', activation: (best as Scored).activation }, evaluated };
    skipPhase(base);
    return { command: { kind: 'skip' }, evaluated };
  }
};

export function* afterSpellCandidates(base: Game, shortlist: Candidate[]): Generator<Candidate> {
  for (const candidate of shortlist) {
    const initial = wizard(base, candidate.activation.wizardId)!;
    const caster = wizard(candidate.game, initial.id)!;
    const remaining = speed(base, initial) - candidate.activation.before.length;
    for (const path of movementPaths(candidate.game, caster.pos!, remaining, caster.side, caster.id)) {
      if (!path.steps.length) continue;
      const activation = { ...candidate.activation, after: path.steps };
      yield { activation, game: activate(base, activation) };
    }
  }
}
