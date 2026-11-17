import { skipPhase, speed, wizard, type ComputerDifficulty, type Game } from '../engine/game';
import { activationSeeds, type Candidate } from './candidates';
import { afterSpellCandidates, didactic, evaluator, tieBreak } from './didactic';
import type { ComputerCommand, ComputerDecision } from './types';
import { choosePlannedMove } from './planner';

type Move = { command: ComputerCommand; game: Game; score: number };
type FollowUp = Candidate & { score: number };

// Preserve the existing, deliberately forgiving Easy policy. Stronger levels use the turn planner.
const easyBudget = { nodes: 3500, milliseconds: 160, width: 8 };

function keepBest<T extends { score: number }>(list: T[], item: T, limit: number, direction: number) {
  if (list.length === limit && direction * item.score <= direction * list[list.length - 1].score) return;
  list.push(item);
  list.sort((a, b) => direction * (b.score - a.score));
  if (list.length > limit) list.pop();
}

function easyChoice(moves: Move[], game: Game) {
  const best = moves[0];
  if (Math.abs(best.score) >= 999999) return best;
  const alternatives = moves.filter(move => move.score >= best.score - 24 && move.score > -999999);
  // Stable per position, including when a saved game is reopened.
  let seed = 2166136261;
  for (const char of JSON.stringify([game.id, game.turn, game.phase, game.wizards, game.copies])) {
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  }
  const weights = alternatives.map(move => Math.exp((move.score - best.score) / 13));
  let draw = ((seed >>> 0) / 4294967296) * weights.reduce((sum, weight) => sum + weight, 0);
  return alternatives.find((_, index) => (draw -= weights[index]) < 0) ?? best;
}

function chooseEasyMove(input: Game): ComputerDecision {
  if (input.stage !== 'playing' || input.pending || input.phase >= 3) return didactic.choose(input);

  const { chronicle: _chronicle, ...position } = input;
  const base = { ...position, log: [] }, evaluate = evaluator(base);
  const budget = easyBudget;
  const started = performance.now(), deadline = started + budget.milliseconds;
  let evaluated = 0;
  const exhausted = () => evaluated >= budget.nodes || performance.now() >= deadline;

  function shortlist(game: Game, width: number, root = false): Move[] {
    const direction = game.active === base.active ? 1 : -1;
    const best: Move[] = [], diverse = new Map<string, Move>(), followUps = new Map<string, FollowUp[]>();
    function consider(candidate: Candidate) {
      evaluated++;
      const { activation } = candidate;
      const score = evaluate(candidate.game) + direction * tieBreak(game, activation);
      const move: Move = { command: { kind: 'activate', activation }, game: candidate.game, score };
      keepBest(best, move, width, direction);
      const key = activation.wizardId + ':' + (activation.spell?.kind ?? 'move');
      const previous = diverse.get(key);
      if (!previous || direction * score > direction * previous.score) diverse.set(key, move);
      return score;
    }
    const wizards = game.wizards.filter(w => w.side === game.active && w.pos && !game.activated.includes(w.id));
    // Interleave wizards so a large spell search cannot consume the entire budget first.
    let seeds = wizards.map(w => activationSeeds(game, w.id));
    while (seeds.length && !exhausted()) {
      seeds = seeds.filter(seed => {
        const next = seed.next();
        if (next.done) return false;
        const candidate = next.value, score = consider(candidate), id = candidate.activation.wizardId;
        if (candidate.activation.spell && !candidate.game.pending && candidate.activation.before.length < speed(game, wizard(game, id)!)) {
          const list = followUps.get(id) ?? [];
          keepBest(list, { ...candidate, score }, root ? 8 : 2, direction);
          followUps.set(id, list);
        }
        return true;
      });
    }
    for (const candidate of afterSpellCandidates(game, [...followUps.values()].flat())) {
      if (exhausted()) break;
      consider(candidate);
    }
    if (!best.length) {
      if (!root && exhausted()) return [];
      const next = skipPhase(game);
      return [{ command: { kind: 'skip' }, game: next, score: evaluate(next) }];
    }
    const mixed = new Set([...best, ...diverse.values()]);
    return [...mixed].sort((a, b) => direction * (b.score - a.score));
  }

  const ranked = shortlist(base, budget.width, true);
  const best = easyChoice(ranked, base);
  return { command: best.command, evaluated };
}

export function chooseMove(input: Game, difficulty: ComputerDifficulty, preferred?: ComputerCommand): ComputerDecision {
  return difficulty === 'easy' ? chooseEasyMove(input) : choosePlannedMove(input, difficulty, () => chooseEasyMove(input), preferred);
}
