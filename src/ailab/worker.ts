import { chooseMove } from '../ai/search';
import { applyComputerCommand, type ComputerPlan } from '../ai/types';
import { decisionPosition } from '../ai/position';
import { immediateWin } from '../ai/tactics';
import { initialGame, repetitionKey, type Case, type Config, type Result } from './model';

self.onmessage = ({ data }: MessageEvent<{ test: Case; config: Config }>) => {
  const { test, config } = data;
  let game = initialGame(test);
  const result: Result = { test, outcome: 'limit', steps: [], final: game, findings: [], audits: { completed: 0, interrupted: 0 }, elapsed: 0 };
  const started = performance.now(), seen = new Map<string, number>();
  let plan: ComputerPlan = [];
  try {
    for (let index = 0; index < config.limit && game.stage !== 'finished'; index++) {
      const key = repetitionKey(game), visits = (seen.get(key) ?? 0) + 1;
      seen.set(key, visits);
      if (visits >= 3) { result.outcome = 'repetition'; break; }
      const before = game, difficulty = test[game.active];
      const preferred = plan.find(step => step.position === decisionPosition(game))?.command;
      const start = performance.now(), decision = chooseMove(game, difficulty, preferred), milliseconds = performance.now() - start;
      const next = applyComputerCommand(game, decision.command);
      if (decisionPosition(next) === decisionPosition(game)) throw new Error('Il comando non modifica la posizione.');
      const step = { before, command: decision.command, milliseconds, evaluated: decision.evaluated, diagnostics: decision.diagnostics, auditMilliseconds: 0 };
      result.steps.push(step);
      const auditStart = performance.now();
      if (config.audit && next.result?.winner !== before.active) {
        const scan = immediateWin(before, performance.now() + 80);
        if (scan.complete) result.audits.completed++; else result.audits.interrupted++;
        if (scan.command && applyComputerCommand(before, scan.command).result?.winner === before.active) result.findings.push({ step: index, kind: 'missed-win', side: before.active, alternative: scan.command });
      }
      step.auditMilliseconds = performance.now() - auditStart;
      plan = decision.continuation ?? [];
      game = { ...next, log: [], chronicle: undefined };
      self.postMessage({ kind: 'progress', commands: result.steps.length, turn: game.turn, side: game.active });
    }
    if (game.result) result.outcome = game.result.winner;
  } catch (error) { result.outcome = 'error'; result.error = error instanceof Error ? error.message : String(error); }
  result.final = game; result.elapsed = performance.now() - started;
  self.postMessage({ kind: 'result', result });
};
