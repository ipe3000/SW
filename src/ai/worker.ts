/// <reference lib="webworker" />
import { chooseMove } from './search';
import type { ComputerDifficulty, Game } from '../engine/game';
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = (event: MessageEvent<{ game: Game; difficulty: ComputerDifficulty }>) => {
  try { scope.postMessage({ decision: chooseMove(event.data.game, event.data.difficulty) }); }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : 'Il computer non è riuscito a scegliere una mossa.' }); }
};
