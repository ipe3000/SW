import { activate, other, wizard, type Activation, type AnalysisPosition, type Game, type Match, type Side } from '../engine/game';
import { evaluator } from './didactic';
import { compareMove } from './search';

export type AnalysisFinding = {
  position: AnalysisPosition;
  alternative: Activation;
  theme: 'survival' | 'elimination' | 'damage';
  mageId: string;
  playedHp: number;
  suggestedHp: number;
  historicalAttack?: { position: AnalysisPosition; mageId: string; damage: number };
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

export function analyzeMatch(history: AnalysisPosition[], side: Side, milliseconds = 57_000): AnalysisFinding | undefined {
  const deadline = performance.now() + milliseconds;
  const ranked = history.flatMap((position, index) => {
    const { before, activation } = position;
    if (before.active !== side) return [];
    const evaluate = evaluator(before), after = activate(before, activation, true);
    if (after.pending?.winner === side) return [];
    const next = history[index + 1]?.before;
    const reply = history.slice(index + 1, index + 7).find(entry => entry.before.turn === before.turn + 1 && entry.before.active === other(side));
    const replied = reply ? activate(reply.before, reply.activation, true) : undefined;
    const impact = next && next.turn <= before.turn + 1 ? evaluate(before) - evaluate(next) : 0;
    const punishment = replied ? evaluate(reply!.before) - evaluate(replied) : 0;
    return [{ position, priority: Math.max(impact, punishment, evaluate(before) - evaluate(after)), reply, replied }];
  }).sort((a, b) => b.priority - a.priority);

  // Sample across the match as well as around the sharpest swings.
  const spread = [...ranked].sort((a, b) => a.position.before.turn - b.position.before.turn);
  const sample = spread.filter((_, index) => index % Math.max(1, Math.ceil(spread.length / 8)) === 0);
  const candidates = [...new Set([...ranked.slice(0, 5), ...sample, ...ranked.slice(5, 10)])];
  for (const { position, reply, replied } of candidates) {
    const remaining = deadline - performance.now();
    if (remaining < 150) break;
    const { before, activation } = position;
    const comparison = compareMove(before, activation, Math.min(4_000, remaining));
    if (!comparison || comparison.depth < 2 || comparison.suggested.score - comparison.played.score < 9) continue;
    const { played, suggested, alternative } = comparison;
    const target = before.wizards.filter(mage => mage.pos).map(mage => {
      const playedHp = health(played.game, mage.id), suggestedHp = health(suggested.game, mage.id);
      const benefit = (suggestedHp - playedHp) * (mage.side === side ? 1 : -1);
      const decisive = benefit > 0 && Math.min(playedHp, suggestedHp) === 0;
      return { mage, playedHp, suggestedHp, benefit, decisive };
    }).filter(entry => entry.benefit > 0).sort((a, b) => Number(b.decisive) - Number(a.decisive) || b.benefit - a.benefit)[0];
    if (!target) continue;
    const { mage, playedHp, suggestedHp, decisive } = target;
    const theme = decisive ? mage.side === side ? 'survival' : 'elimination' : 'damage';
    const losses = reply && replied ? reply.before.wizards.filter(w => w.side === side)
      .map(w => ({ mageId: w.id, damage: health(reply.before, w.id) - health(replied, w.id) }))
      .filter(loss => loss.damage > 0).sort((a, b) => b.damage - a.damage) : [];
    const historicalAttack = reply && losses.length ? { position: reply, ...losses[0] } : undefined;
    return { position, alternative, theme, mageId: mage.id, playedHp, suggestedHp, historicalAttack };
  }
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
