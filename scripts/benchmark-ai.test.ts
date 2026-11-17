import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { chooseMove as previous } from './ai-baseline/search';
import { chooseMove } from '../src/ai/search';
import { applyComputerCommand } from '../src/ai/types';
import { defaultOptions, newMatch } from '../src/engine/game';

it('confronta le due versioni con semi e colori scambiati', () => {
  const rows: unknown[] = [];
  const levels = process.env.SW_AI_BENCHMARK_LEVELS === 'hard' ? ['hard'] as const : ['normal', 'hard'] as const;
  for (const level of levels) for (const seed of [301, 502]) for (const side of ['red', 'blue'] as const) {
    let state = seed;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    let game = newMatch({ ...defaultOptions, hp: seed === 301 ? 3 : 5, walls: 'varied' }, random).game;
    game.id = `benchmark-${seed}`;
    let commands = 0, totalMs = 0, longestMs = 0, choices = 0;
    for (; commands < 150 && game.stage !== 'finished'; commands++) {
      const improved = game.active === side, start = performance.now();
      const decision = improved ? chooseMove(game, level) : previous(game, level);
      const duration = performance.now() - start;
      if (improved) { totalMs += duration; longestMs = Math.max(longestMs, duration); choices++; }
      game = applyComputerCommand(game, decision.command);
    }
    const row = { level, seed, side, winner: game.result?.winner, outcome: game.result ? game.result.winner === side ? 'new' : 'old' : 'unfinished',
      commands, turns: game.turn, averageMs: Math.round(totalMs / choices), longestMs: Math.round(longestMs) };
    rows.push(row);
    writeFileSync('scripts/benchmark-results.json', JSON.stringify(rows, null, 2));
    console.info(JSON.stringify(row));
  }
});
