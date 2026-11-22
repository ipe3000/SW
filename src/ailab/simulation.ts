import { chooseMove } from '../ai/search';
import type { HardProfile } from '../ai/profile';
import { applyComputerCommand, type ComputerCommand, type ComputerPlan } from '../ai/types';
import { decisionPosition } from '../ai/position';
import { immediateWin } from '../ai/tactics';
import type { Side } from '../engine/game';
import { initialGame, repetitionKey, type Case, type Config, type Result, type Step } from './model';

export type MatchProgress = { commands: number; turn: number; side: Side };
type SideStats = { decisions: number; milliseconds: number; maxMs: number; evaluated: number; timedOut: number; nodesExhausted: number; fallbacks: number };
export type MatchSummary = Pick<Result, 'outcome' | 'elapsed' | 'error'> & {
  commands: number;
  stats: Record<Side, SideStats>;
  trace?: ComputerCommand[];
};

type MatchOptions = {
  limit: number;
  profiles?: Partial<Record<Side, HardProfile>>;
  trace?: boolean;
  traceOnError?: boolean;
  onProgress?: (progress: MatchProgress) => void;
  onStep?: (step: Step, next: ReturnType<typeof initialGame>) => void;
};

function emptyStats(): SideStats {
  return { decisions: 0, milliseconds: 0, maxMs: 0, evaluated: 0, timedOut: 0, nodesExhausted: 0, fallbacks: 0 };
}

function simulate(test: Case, options: MatchOptions) {
  let game = initialGame(test);
  const started = performance.now(), seen = new Map<string, number>();
  const plans: Record<Side, ComputerPlan> = { red: [], blue: [] };
  const stats = { red: emptyStats(), blue: emptyStats() };
  const trace: ComputerCommand[] | undefined = options.trace || options.traceOnError ? [] : undefined;
  let outcome: Result['outcome'] = 'limit', error: string | undefined, commands = 0;
  try {
    while (commands < options.limit && game.stage !== 'finished') {
      const key = repetitionKey(game), visits = (seen.get(key) ?? 0) + 1;
      seen.set(key, visits);
      if (visits >= 3) { outcome = 'repetition'; break; }
      const before = game, side = game.active;
      const position = decisionPosition(game);
      const preferred = plans[side].find(step => step.position === position)?.command;
      const start = performance.now();
      const decision = chooseMove(game, test[side], preferred, options.profiles?.[side]);
      const milliseconds = performance.now() - start;
      const next = applyComputerCommand(game, decision.command);
      if (decisionPosition(next) === position) throw new Error('Il comando non modifica la posizione.');
      const sideStats = stats[side], diagnostics = decision.diagnostics;
      sideStats.decisions++;
      sideStats.milliseconds += milliseconds;
      sideStats.maxMs = Math.max(sideStats.maxMs, milliseconds);
      sideStats.evaluated += decision.evaluated;
      sideStats.timedOut += Number(diagnostics?.timeExhausted === true);
      sideStats.nodesExhausted += Number(diagnostics?.nodesExhausted === true);
      sideStats.fallbacks += Number(diagnostics?.source === 'fallback');
      commands++;
      trace?.push(decision.command);
      options.onStep?.({ before, command: decision.command, milliseconds, evaluated: decision.evaluated, diagnostics }, next);
      plans[side] = decision.continuation ?? [];
      game = { ...next, log: [] };
      options.onProgress?.({ commands, turn: game.turn, side: game.active });
    }
    if (game.result) outcome = game.result.winner;
  } catch (cause) {
    outcome = 'error';
    error = cause instanceof Error ? cause.message : String(cause);
  }
  const summary: MatchSummary = { outcome, elapsed: performance.now() - started, error, commands, stats,
    trace: options.trace || outcome === 'error' ? trace : undefined };
  return { summary, final: game };
}

export function simulateSummary(test: Case, options: Omit<MatchOptions, 'onStep'>): MatchSummary {
  return simulate(test, options).summary;
}

export function simulateCampaignMatch(test: Case, config: Config, onProgress?: MatchOptions['onProgress']): Result {
  const steps: Result['steps'] = [], findings: Result['findings'] = [];
  const audits = { completed: 0, interrupted: 0 };
  const { summary, final } = simulate(test, {
    limit: config.limit,
    onProgress,
    onStep(step, next) {
      steps.push(step);
      const started = performance.now();
      if (config.audit && next.result?.winner !== step.before.active) {
        const before = step.before;
        const scan = immediateWin(before, started + 80);
        if (scan.complete) audits.completed++; else audits.interrupted++;
        if (scan.command && applyComputerCommand(before, scan.command).result?.winner === before.active) {
          findings.push({ step: steps.length - 1, kind: 'missed-win', side: before.active, alternative: scan.command });
        }
      }
      step.auditMilliseconds = performance.now() - started;
    },
  });
  return { test, outcome: summary.outcome, steps, final, findings, audits, error: summary.error, elapsed: summary.elapsed };
}
