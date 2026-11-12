import { activate, other, wizard, type AnalysisPosition, type Game, type Match, type Side } from '../engine/game';
import { evaluator } from './didactic';
import { compareMove, type AnalysisSearch, type MoveComparison } from './search';

export const analysisBudgetMs = 120_000;
export type AnalysisFinding = {
  position: AnalysisPosition;
  historical: AnalysisPosition[];
  suggested: AnalysisPosition[];
  theme: 'survival' | 'elimination' | 'damage';
  mageId: string;
  playedHp: number;
  suggestedHp: number;
};

export function analysisPositions(match: Match): AnalysisPosition[] {
  return match.analysisHistory?.length ? match.analysisHistory : [match.replays?.red, match.replays?.blue]
    .flatMap(turn => turn?.entries ?? []).sort((a, b) => a.before.turn - b.before.turn || a.before.phase - b.before.phase)
    .map(({ before, activation }) => ({ before, activation }));
}

const health = (game: Game, id: string) => {
  const mage = wizard(game, id);
  return mage?.pos ? mage.hp : 0;
};

function assess(position: AnalysisPosition, comparison: MoveComparison | undefined, historical: AnalysisPosition[]) {
  if (!comparison) return undefined;
  const { before } = position;
  const { played, suggested, alternative, depth } = comparison;
  const gain = suggested.score - played.score;
  if (gain < 9) return undefined;
  const target = before.wizards.filter(mage => mage.pos).map(mage => {
    const playedHp = health(played.game, mage.id), suggestedHp = health(suggested.game, mage.id);
    const benefit = (suggestedHp - playedHp) * (mage.side === before.active ? 1 : -1);
    return { mage, playedHp, suggestedHp, benefit, decisive: benefit > 0 && Math.min(playedHp, suggestedHp) === 0 };
  }).filter(entry => entry.benefit > 0).sort((a, b) => Number(b.decisive) - Number(a.decisive) || b.benefit - a.benefit)[0];
  if (!target) return undefined;
  const { mage, playedHp, suggestedHp, decisive } = target;
  const theme = decisive ? mage.side === before.active ? 'survival' : 'elimination' : 'damage';
  const finding: AnalysisFinding = {
    position, historical, suggested: [{ before, activation: alternative }, ...(suggested.steps ?? [])],
    theme, mageId: mage.id, playedHp, suggestedHp,
  };
  return { finding, depth, priority: (decisive ? 130 : 0) + Math.min(gain, 200) + depth * 8 };
}

export function analyzeMatch(history: AnalysisPosition[], side: Side, milliseconds = analysisBudgetMs - 1_500): AnalysisFinding[] {
  const started = performance.now(), deadline = started + milliseconds;
  const ranked = history.flatMap((position, index) => {
    const { before, activation } = position;
    if (before.active !== side) return [];
    const evaluate = evaluator(before), after = activate(before, activation, true);
    if (after.pending?.winner === side) return [];
    const nearby = history.slice(index, index + 6).filter(entry => entry.before.turn <= before.turn + 1);
    // Include the actual follow-through through the opponent's next turn.
    const next = nearby.find(entry => entry.before.active !== side);
    const last = nearby.at(-1)!;
    const outcome = activate(last.before, last.activation, true);
    const swing = Math.max(evaluate(before) - evaluate(after), next ? evaluate(next.before) - evaluate(outcome) : 0);
    return [{ position, historical: next ? nearby : [position], swing, screen: 0 }];
  }).sort((a, b) => b.swing - a.swing);

  function compare(position: AnalysisPosition, budget: AnalysisSearch) {
    const remaining = deadline - performance.now();
    return remaining > 0 ? compareMove(position.before, position.activation, { ...budget, milliseconds: Math.min(budget.milliseconds, remaining) }) : undefined;
  }

  // Give quiet moves a chance to surface missed opportunities, even when the real evaluation barely changed.
  const screeningDeadline = started + milliseconds * .24;
  for (const [index, entry] of ranked.entries()) {
    const remaining = screeningDeadline - performance.now();
    if (remaining <= 0) break;
    const trial = compare(entry.position, { milliseconds: Math.min(230, remaining / (ranked.length - index)), depth: 1, width: 5, nodes: 8_000 });
    if (trial) entry.screen = Math.min(200, Math.max(0, trial.suggested.score - trial.played.score));
  }
  const candidates = ranked.sort((a, b) => b.swing + b.screen - a.swing - a.screen).slice(0, 18);
  const reviewed: { entry: typeof candidates[number]; assessment: ReturnType<typeof assess> }[] = [];
  const deeperDeadline = started + milliseconds * .72;
  for (const [index, entry] of candidates.entries()) {
    const remaining = deeperDeadline - performance.now();
    if (remaining <= 0) break;
    const trial = compare(entry.position, { milliseconds: Math.min(8_000, remaining / (candidates.length - index)), depth: 5, width: 10, nodes: 360_000 });
    reviewed.push({ entry, assessment: assess(entry.position, trial, entry.historical) });
  }

  // Widen the branches on a second pass. A completed deeper comparison can overturn the first recommendation.
  const finalists = reviewed.sort((a, b) => (b.assessment?.priority ?? -1) - (a.assessment?.priority ?? -1)).slice(0, 8);
  for (const [index, candidate] of finalists.entries()) {
    const { entry } = candidate;
    const trial = compare(entry.position, { milliseconds: (deadline - performance.now()) / (finalists.length - index), depth: 8, width: 15, nodes: 1_200_000 });
    if (trial && trial.depth >= (candidate.assessment?.depth ?? 2)) candidate.assessment = assess(entry.position, trial, entry.historical);
  }

  const results: AnalysisFinding[] = [];
  for (const item of reviewed.flatMap(({ assessment }) => assessment && assessment.depth >= 2 ? [assessment] : []).sort((a, b) => b.priority - a.priority)) {
    const { finding } = item;
    if (results.some(previous => previous.position.before.turn === finding.position.before.turn ||
      previous.mageId === finding.mageId && previous.theme === finding.theme)) continue;
    results.push(finding);
    if (results.length === 3) break;
  }
  return results.sort((a, b) => a.position.before.turn - b.position.before.turn || a.position.before.phase - b.position.before.phase);
}

export function practiceMatch(match: Match, position: Pick<AnalysisPosition, 'before'>): Match {
  const side = other(position.before.active);
  const difficulty = match.computer?.difficulty?.[side] ?? 'hard';
  return {
    format: 'strategic-wizardry-local', version: 2, revision: 0, undo: [], savedAt: new Date().toISOString(),
    game: { ...structuredClone(position.before), id: crypto.randomUUID(), options: { ...match.game.options, [side === 'red' ? 'redName' : 'blueName']: 'Computer didattico' } },
    computer: { profile: 'didactic-v1', side, difficulty: { [side]: difficulty } }
  };
}
