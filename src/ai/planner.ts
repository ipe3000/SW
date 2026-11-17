import { endTurn, finishesActivation, hasExtraStep, skipPhase, speed, wizard, type Game } from '../engine/game';
import { activationSeeds, type Candidate } from './candidates';
import { afterSpellCandidates, didactic, evaluator, tieBreak } from './didactic';
import { type ComputerCommand, type ComputerDecision } from './types';

export const planningBudgets = {
  normal: { milliseconds: 750, nodes: 24_000, depth: 4, width: 7, branch: 2, candidates: 160 },
  hard: { milliseconds: 2600, nodes: 95_000, depth: 7, width: 10, branch: 3, candidates: 160 }
};
type Move = { command: ComputerCommand; game: Game; score: number; forcing: boolean; family: string };
type Bound = { depth: number; extension: number; score: number; kind: 'exact' | 'lower' | 'upper' };
export type PlannedDecision = ComputerDecision & { depth: number; replies: number; cacheHits: number };

/** Keep preparation and defensive moves alongside immediate damage, without filling every slot with variants of one spell. */
function varied(moves: Move[], width: number): Move[] {
  const result = moves.slice(0, Math.max(1, Math.ceil(width / 2)));
  const families = new Set(result.map(move => move.family));
  for (const move of moves) {
    if (result.length >= width) break;
    if (!families.has(move.family)) { result.push(move); families.add(move.family); }
  }
  for (const move of moves) {
    if (result.length >= width) break;
    if (!result.includes(move)) result.push(move);
  }
  return result;
}

export function choosePlannedMove(input: Game, difficulty: 'normal' | 'hard'): ComputerDecision | PlannedDecision {
  if (input.stage !== 'playing' || input.pending || input.phase >= 3) return didactic.choose(input);
  const { chronicle: _chronicle, ...position } = input;
  const base: Game = { ...position, log: [] };
  const budget = planningBudgets[difficulty], start = performance.now(), deadline = start + budget.milliseconds;
  const evaluate = evaluator(base, true), branches = new Map<string, Move[]>(), scores = new Map<string, Bound>();
  let evaluated = 0, completedDepth = 1, replies = 0, cacheHits = 0;
  const exhausted = () => evaluated >= budget.nodes || performance.now() >= deadline;
  // Only rule-relevant state: walls/options are fixed during this search, histories never participate.
  const positionKey = (game: Game) => JSON.stringify([game.turn, game.active, game.phase, game.activity,
    [...game.activated].sort(), game.wizards, game.copies]);

  function shortlist(game: Game, root = false): Move[] {
    const key = positionKey(game), cached = branches.get(key);
    if (cached) { cacheHits++; return cached; }
    const direction = game.active === base.active ? 1 : -1;
    const moves: Move[] = [], endpoints = new Set<string>();
    const followUps = new Map<string, (Candidate & { score: number })[]>();
    const limit = root ? budget.candidates * 3 : game.phase === 2 ? 80 : budget.candidates;
    const localStart = performance.now();
    const localDeadline = Math.min(deadline, localStart + budget.milliseconds * (root ? .18 : .025));
    const seedDeadline = localStart + (localDeadline - localStart) * .75;
    let count = 0;
    const stopped = () => count >= limit || exhausted() || performance.now() >= localDeadline;
    function consider(candidate: Candidate) {
      count++;
      const { activation } = candidate, next = candidate.game;
      // Multiple movement/spell routes often end in exactly the same position.
      const signature = positionKey(next);
      if (endpoints.has(signature)) return;
      endpoints.add(signature);
      evaluated++;
      const score = evaluate(next) + direction * tieBreak(game, activation);
      const forcing = Boolean(next.pending || next.wizards.length < game.wizards.length ||
        next.wizards.some(mage => mage.hp < (wizard(game, mage.id)?.hp ?? mage.hp)));
      moves.push({ command: { kind: 'activate', activation }, game: next, score, forcing,
        family: activation.wizardId + ':' + (activation.spell?.kind ?? 'move') });
      if (activation.spell && !next.pending && activation.before.length < speed(game, wizard(game, activation.wizardId)!)) {
        const list = followUps.get(activation.wizardId) ?? [];
        list.push({ ...candidate, score });
        list.sort((a, b) => direction * (b.score - a.score));
        list.length = Math.min(list.length, root ? 4 : 2);
        followUps.set(activation.wizardId, list);
      }
    }
    let seeds = game.wizards.filter(w => w.side === game.active && w.pos && !game.activated.includes(w.id))
      .map(w => activationSeeds(game, w.id, true));
    // Reserve a quarter of each generation budget for moving away after casting.
    while (seeds.length && count < limit * .75 && performance.now() < seedDeadline && !stopped()) {
      seeds = seeds.filter(seed => {
        if (stopped()) return false;
        const next = seed.next();
        if (next.done) return false;
        consider(next.value);
        return true;
      });
    }
    for (const candidate of afterSpellCandidates(game, [...followUps.values()].flat())) {
      if (stopped()) break;
      consider(candidate);
    }
    // Passing is strategic too: retaining a useful formation can be better than moving a third mage.
    if (!exhausted()) {
      try {
        const next = skipPhase(game);
        moves.push({ command: { kind: 'skip' }, game: next, score: evaluate(next), forcing: false, family: 'skip' });
      } catch { /* The shared rules require activity before some phases may be passed. */ }
    }
    moves.sort((a, b) => direction * (b.score - a.score));
    const selected = varied(moves, root ? budget.width : budget.branch + 2);
    // Keep caches bounded even in sparse endgames with many equivalent sequences.
    if (branches.size < 2500 && selected.length) branches.set(key, selected);
    return selected;
  }

  const advanced = new WeakMap<Move, Game>();
  function advance(game: Game, move: Move) {
    // Use the same atomic phase/turn transitions as the actual computer, including a skipped extra step.
    const cached = advanced.get(move);
    if (cached) return cached;
    const next = move.game;
    const finished = move.command.kind === 'activate' ? finishesActivation(game, next)
      : next.phase >= 3 || next.phase === 2 && !hasExtraStep(next);
    const result = finished ? endTurn(next) : next;
    advanced.set(move, result);
    return result;
  }

  function search(game: Game, depth: number, extension: number, alpha: number, beta: number, breadth: number, noisy = false): number | undefined {
    if (game.result || game.pending) return evaluate(game);
    if (exhausted()) return undefined;
    // Normal sees the first enemy activation; Hard completes the enemy turn before evaluating a leaf.
    // At most three extra activations prevent an unbounded extension through successive turns.
    const replyIncomplete = game.turn <= base.turn + 1 && (game.active === base.active ||
      (difficulty === 'hard' ? true : game.phase === 0));
    const tacticalLeaf = depth <= 0 && !replyIncomplete && extension > 0 && noisy && difficulty === 'hard' && breadth > 1;
    if (depth <= 0 && !tacticalLeaf && (!replyIncomplete || extension === 0)) return evaluate(game);
    const key = breadth + ':' + Number(tacticalLeaf) + ':' + positionKey(game);
    const known = scores.get(key), originalAlpha = alpha, originalBeta = beta;
    if (known && known.depth === depth && known.extension === extension) {
      if (known.kind === 'exact') return known.score;
      if (known.kind === 'lower') alpha = Math.max(alpha, known.score);
      else beta = Math.min(beta, known.score);
      if (alpha >= beta) return known.score;
    }
    const direction = game.active === base.active ? 1 : -1;
    const candidates = shortlist(game);
    const moves = tacticalLeaf ? candidates.filter(move => move.forcing) : candidates;
    if (tacticalLeaf && !moves.length) return evaluate(game);
    if (!moves.length || exhausted()) return undefined;
    let best = tacticalLeaf ? evaluate(game) : direction > 0 ? -Infinity : Infinity;
    // The extra step cannot cast: a small positional sample leaves more time for real attacks.
    const width = game.phase === 2 ? 1 : breadth;
    for (const move of moves.slice(0, width)) {
      if (game.active !== base.active) replies++;
      const next = advance(game, move);
      const value = search(next, depth - 1, depth <= 0 ? extension - 1 : extension, alpha, beta, breadth, move.forcing);
      if (value === undefined) return undefined;
      best = direction > 0 ? Math.max(best, value) : Math.min(best, value);
      if (direction > 0) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    if (scores.size < 6000) scores.set(key, { depth, extension, score: best,
      kind: best <= originalAlpha ? 'upper' : best >= originalBeta ? 'lower' : 'exact' });
    return best;
  }

  const roots = shortlist(base, true);
  // An unusually slow device may exhaust its clock during candidate generation; always return a legal command.
  if (!roots.length) return didactic.choose(base);
  const winning = roots.find(move => (move.game.pending ?? move.game.result)?.winner === base.active);
  if (winning) return { command: winning.command, evaluated };
  let best = roots[0];
  // Complete a fair comparison of all roots before accepting a deeper result.
  // Hard first completes a narrow full-turn comparison, then widens it. Spending the entire clock
  // on a broad shallow iteration would leave it blind to the enemy despite its larger budget.
  const rounds = difficulty === 'hard'
    ? [{ depth: 5, breadth: 1, extension: 1 }, { depth: 5, breadth: 2, extension: 1 },
      { depth: 5, breadth: 3, extension: 1 }, { depth: budget.depth, breadth: 2, extension: 2 }]
    : Array.from({ length: budget.depth - 1 }, (_, i) => ({ depth: i + 2, breadth: budget.branch, extension: i }));
  for (const { depth, breadth, extension } of rounds) {
    if (exhausted()) break;
    const ranked: { move: Move; score: number }[] = [];
    for (const move of roots) {
      const score = search(advance(base, move), depth - 1, extension, -Infinity, Infinity, breadth);
      if (score === undefined) break;
      ranked.push({ move, score });
    }
    if (ranked.length !== roots.length) break;
    ranked.sort((a, b) => b.score - a.score || b.move.score - a.move.score);
    best = ranked[0].move;
    completedDepth = depth;
    // Ordering changes, eligibility does not: a quiet preparation may improve only at a later depth.
    roots.splice(0, roots.length, ...ranked.map(entry => entry.move));
    if (ranked[0].score >= 999999) break;
  }
  return { command: best.command, evaluated, depth: completedDepth, replies, cacheHits };
}
