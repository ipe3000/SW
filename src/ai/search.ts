import { endTurn, finishesActivation, skipPhase, speed, wizard, activate, type Activation, type AnalysisPosition, type ComputerDifficulty, type Game } from '../engine/game';
import { activationSeeds, type Candidate } from './candidates';
import { afterSpellCandidates, didactic, evaluator, tieBreak } from './didactic';
import type { ComputerCommand, ComputerDecision } from './types';

type Move = { command: ComputerCommand; game: Game; score: number };
type FollowUp = Candidate & { score: number };

const budgets = {
  easy: { nodes: 3500, milliseconds: 160, depth: 1, width: 8 },
  normal: { nodes: 16000, milliseconds: 480, depth: 2, width: 9 },
  hard: { nodes: 65000, milliseconds: 1400, depth: 5, width: 12 }
};

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

type SearchLine = { score: number; game: Game; steps?: AnalysisPosition[] };
export type AnalysisSearch = { milliseconds: number; depth: number; width: number; nodes: number };
export type MoveComparison = { alternative: Activation; played: SearchLine; suggested: SearchLine; depth: number };

export function compareMove(game: Game, played: Activation, budget: AnalysisSearch): MoveComparison | undefined {
  return chooseMove(game, 'hard', { played, budget }).comparison;
}

export function chooseMove(input: Game, difficulty: ComputerDifficulty, analysis?: { played: Activation; budget: AnalysisSearch }): ComputerDecision & { comparison?: MoveComparison } {
  if (input.stage !== 'playing' || input.pending || input.phase >= 3) return didactic.choose(input);

  const base = { ...input, log: [] }, evaluate = evaluator(base);
  const budget = analysis?.budget ?? budgets[difficulty];
  const started = performance.now(), deadline = started + budget.milliseconds;
  const rootDeadline = analysis ? started + budget.milliseconds * .28 : deadline;
  let evaluated = 0;
  const exhausted = () => evaluated >= budget.nodes || performance.now() >= deadline;

  function shortlist(game: Game, width: number, root = false): Move[] {
    const limit = () => exhausted() || (root && performance.now() >= rootDeadline);
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
    while (seeds.length && !limit()) {
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
      if (limit()) break;
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

  const advanced = new Map<Move, Game>();
  const branches = new Map<Game, Move[]>();
  function advance(game: Game, move: Move): Game {
    const known = advanced.get(move);
    if (known) return known;
    const next = { ...move.game, log: [] };
    const result = next.pending || next.phase >= 3 || (move.command.kind === 'activate' && finishesActivation(game, next)) ? endTurn(next) : next;
    if (analysis) advanced.set(move, result);
    return result;
  }

  function search(game: Game, depth: number, alpha = -Infinity, beta = Infinity): SearchLine | undefined {
    if (!depth || game.result || game.pending || difficulty === 'normal' && game.active !== base.active) return { score: evaluate(game), game };
    if (exhausted()) return undefined;
    const direction = game.active === base.active ? 1 : -1;
    const width = analysis ? Math.max(2, Math.floor(budget.width / 3)) : 2;
    const moves = branches.get(game) ?? shortlist(game, width);
    if (exhausted()) return undefined;
    if (analysis) branches.set(game, moves);
    let best: SearchLine | undefined;
    for (const move of moves.slice(0, width)) {
      const line = search(advance(game, move), depth - 1, alpha, beta);
      if (!line) return undefined;
      if (!best || (line.score - best.score) * direction > 0) {
        best = analysis && move.command.kind === 'activate'
          ? { ...line, steps: [{ before: game, activation: move.command.activation }, ...(line.steps ?? [])] }
          : line;
      }
      if (direction > 0) alpha = Math.max(alpha, best.score);
      else beta = Math.min(beta, best.score);
      if (analysis && alpha >= beta) break;
    }
    return best;
  }

  const ranked = shortlist(base, budget.width, true);
  if (analysis) {
    const playedGame = activate(base, analysis.played, true);
    const playedMove: Move = { command: { kind: 'activate', activation: analysis.played }, game: playedGame, score: evaluate(playedGame) };
    const actual = JSON.stringify(analysis.played);
    const alternatives = ranked.filter(move => move.command.kind === 'activate' && JSON.stringify(move.command.activation) !== actual);
    const seen = new Set<string>();
    const diverse = alternatives.filter(({ command }) => {
      if (command.kind !== 'activate') return false;
      const key = command.activation.wizardId + ':' + (command.activation.spell?.kind ?? 'move');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    let roots = [...new Set([...alternatives.slice(0, Math.ceil(budget.width / 2)), ...diverse, ...alternatives])].slice(0, budget.width);
    let comparison: MoveComparison | undefined;
    for (let depth = 1; roots.length && depth <= budget.depth && !exhausted(); depth++) {
      const played = search(advance(base, playedMove), depth - 1);
      if (!played) break;
      const scores = roots.map(move => ({ move, line: search(advance(base, move), depth - 1) }));
      if (scores.some(entry => !entry.line)) break;
      scores.sort((a, b) => b.line!.score - a.line!.score);
      const { move, line } = scores[0];
      if (move.command.kind === 'activate') comparison = { alternative: move.command.activation, played, suggested: line!, depth };
      if (move.game.pending?.winner === base.active && played.game.result?.loser === base.active &&
          (playedMove.game.pending || played.steps?.length === 1 && played.steps[0].before.active !== base.active &&
            activate(played.steps[0].before, played.steps[0].activation).pending?.loser === base.active)) break;
      roots = scores.slice(0, Math.max(3, budget.width - depth * 2)).map(entry => entry.move);
    }
    return { command: ranked[0].command, evaluated, comparison };
  }
  let best = ranked[0];
  if (difficulty === 'easy') best = easyChoice(ranked, base);
  if (difficulty !== 'easy' && best.score < 999999) {
    // Reserve space for distinct wizard and spell choices as well as high-scoring variants.
    const seen = new Set<string>();
    const varied = ranked.filter(move => {
      if (move.command.kind !== 'activate') return true;
      const { wizardId, spell } = move.command.activation, key = wizardId + ':' + (spell?.kind ?? 'move');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    let roots = [...new Set([...ranked.slice(0, 4), ...varied])].slice(0, budget.width);
    for (let depth = 2; depth <= budget.depth && !exhausted(); depth++) {
      const scores: { move: Move; score: number }[] = [];
      for (const move of roots) {
        const score = search(advance(base, move), depth - 1)?.score;
        if (score === undefined) break;
        scores.push({ move, score });
      }
      if (scores.length !== roots.length) break;
      scores.sort((a, b) => b.score - a.score);
      best = scores[0].move;
      roots = scores.slice(0, Math.max(3, budget.width - depth * 2)).map(entry => entry.move);
    }
  }
  return { command: best.command, evaluated };
}
