import { expect, it } from 'vitest';
import { defaultOptions, newMatch } from '../src/engine/game';
import { readMatch } from '../src/engine/backup';
import { didactic } from '../src/ai/didactic';
import { applyComputerCommand } from '../src/ai/types';

const cases = ([3, 4, 5] as const).flatMap(hp => (['standard', 'varied'] as const).map((walls, i) => ({ hp, walls, seed: hp * 100 + i })));
it.each(cases)('simula una partita con $hp PV, muri $walls', ({ hp, walls, seed }) => {
  let state = seed;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  let game = newMatch({ ...defaultOptions, hp, walls }, random).game;
  let commands = 0, elapsed = 0, longest = 0;
  for (; commands < 200 && game.stage !== 'finished'; commands++) {
    const start = performance.now(), decision = didactic.choose(game), duration = performance.now() - start;
    elapsed += duration; longest = Math.max(longest, duration);
    const next = applyComputerCommand(game, decision.command);
    readMatch({ format: 'strategic-wizardry-local', version: 1, revision: commands, game: next, undo: [], savedAt: new Date().toISOString() });
    expect(next).not.toEqual(game); game = next;
  }
  console.info(JSON.stringify({ hp, walls, seed, commands, turns: game.turn, stage: game.stage, totalMs: Math.round(elapsed), longestMs: Math.round(longest) }));
  expect(game.stage).toBe('finished');
  expect(longest).toBeLessThan(6000);
}, 60000);
