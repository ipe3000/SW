import { activate, other, wizard, type AnalysisPosition, type Game, type Match, type Side } from '../engine/game';
import { evaluator } from './didactic';
import { compareMove, type MoveComparison } from './search';

export const scanBudgetMs = 60_000;
export const suggestionBudgetMs = 45_000;
export type AnalysisMoment = { position: AnalysisPosition; historical: AnalysisPosition[] };
export type AnalysisRequest = { kind: 'scan'; positions: AnalysisPosition[]; side: Side } | { kind: 'suggest'; moment: AnalysisMoment };
export type AnalysisResponse = { kind: 'scan'; moments: AnalysisMoment[] } | { kind: 'suggest'; suggestion: AnalysisFinding | null };
export type AnalysisFinding = AnalysisMoment & {
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

export function findMoments(history: AnalysisPosition[], side: Side, milliseconds = scanBudgetMs - 750): AnalysisMoment[] {
  const started = performance.now();
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
    const historical = next ? nearby : [position];
    const loss = next && before.wizards.filter(mage => mage.side === side && mage.pos)
      .map(mage => ({ id: mage.id, hp: health(outcome, mage.id), damage: health(next.before, mage.id) - health(outcome, mage.id) }))
      .filter(mage => mage.damage >= 2 || mage.damage > 0 && mage.hp === 0)
      .sort((a, b) => Number(a.hp > 0) - Number(b.hp > 0) || b.damage - a.damage)[0];
    return [{ position, historical, loss, swing, screen: 0 }];
  }).sort((a, b) => b.swing - a.swing);

  // Give quiet moves a chance to surface missed opportunities, even when the real evaluation barely changed.
  const screeningDeadline = started + milliseconds * .35;
  for (const [index, entry] of ranked.entries()) {
    const remaining = screeningDeadline - performance.now();
    if (remaining <= 0) break;
    const trial = compareMove(entry.position.before, entry.position.activation, { milliseconds: Math.min(230, remaining / (ranked.length - index)), depth: 1, width: 5, nodes: 8_000 });
    if (trial) entry.screen = Math.min(200, Math.max(0, trial.suggested.score - trial.played.score));
  }
  const candidates = ranked.sort((a, b) => b.swing + b.screen - a.swing - a.screen).slice(0, 18);
  const reviewed: { entry: typeof candidates[number]; assessment: ReturnType<typeof assess> }[] = [];
  const deeperDeadline = started + milliseconds * .9;
  for (const [index, entry] of candidates.entries()) {
    const remaining = deeperDeadline - performance.now();
    if (remaining <= 0) break;
    const trial = compareMove(entry.position.before, entry.position.activation, { milliseconds: Math.min(5_000, remaining / (candidates.length - index)), depth: 4, width: 9, nodes: 360_000 });
    reviewed.push({ entry, assessment: assess(entry.position, trial, entry.historical) });
  }

  const noteworthy = reviewed.flatMap(({ entry, assessment }) => {
    if (assessment && assessment.depth >= 2) {
      const { position, historical, mageId, theme } = assessment.finding;
      return [{ position, historical, key: mageId + ':' + theme, priority: assessment.priority }];
    }
    if (!entry.loss) return [];
    return [{ position: entry.position, historical: entry.historical, key: entry.loss.id + ':' + (entry.loss.hp ? 'damage' : 'survival'),
      priority: (entry.loss.hp ? 0 : 130) + entry.loss.damage * 12 }];
  }).sort((a, b) => b.priority - a.priority);
  const results: typeof noteworthy = [];
  for (const moment of noteworthy) {
    if (results.some(previous => previous.position.before.turn === moment.position.before.turn || previous.key === moment.key)) continue;
    results.push(moment);
    if (results.length === 3) break;
  }
  return results.sort((a, b) => a.position.before.turn - b.position.before.turn || a.position.before.phase - b.position.before.phase)
    .map(({ position, historical }) => ({ position, historical }));
}

export function suggestMove(moment: AnalysisMoment, milliseconds = suggestionBudgetMs - 750): AnalysisFinding | null {
  const { before, activation } = moment.position;
  const comparison = compareMove(before, activation, { milliseconds, depth: 10, width: 18, nodes: 1_600_000 });
  if (!comparison || comparison.depth < 2) return null;
  const hasReply = (line: MoveComparison['played']) =>
    line.game.result || line.game.turn > before.turn + 1 || line.steps?.some(step => step.before.active !== before.active);
  if (!hasReply(comparison.played) || !hasReply(comparison.suggested)) return null;
  return assess(moment.position, comparison, moment.historical)?.finding ?? null;
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
