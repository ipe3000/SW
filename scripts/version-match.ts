import { applyComputerCommand, type ComputerDecision, type ComputerPlan } from '../src/ai/types';
import { decisionPosition } from '../src/ai/position';
import type { ComputerDifficulty, Game } from '../src/engine/game';

export type VersionPlayer = { id: string; choose: (game: Game, level: ComputerDifficulty, preferred?: ComputerDecision['command']) => ComputerDecision };
export function runVersionMatch(initial: Game, red: VersionPlayer, blue: VersionPlayer, level: ComputerDifficulty, maxCommands: number) {
  let game = structuredClone(initial);
  const plans: Record<string, ComputerPlan> = { red: [], blue: [] };
  const steps: { before: Game; command: ComputerDecision['command']; version: string; milliseconds: number; evaluated: number; diagnostics?: ComputerDecision['diagnostics'] }[] = [];
  while (game.stage !== 'finished' && steps.length < maxCommands) {
    const side = game.active, player = side === 'red' ? red : blue;
    const preferred = plans[side].find(step => step.position === decisionPosition(game))?.command;
    const start = performance.now();
    const decision = player.choose(game, level, preferred);
    const milliseconds = performance.now() - start;
    const next = applyComputerCommand(game, decision.command);
    plans[side] = decision.continuation ?? [];
    steps.push({ before: game, command: decision.command, version: player.id, milliseconds, evaluated: decision.evaluated, diagnostics: decision.diagnostics });
    game = next;
  }
  return { red: red.id, blue: blue.id, level, outcome: game.result ? (game.result.winner === 'red' ? red.id : blue.id) : 'unfinished', steps, final: game };
}
