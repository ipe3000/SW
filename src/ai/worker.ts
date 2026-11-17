/// <reference lib="webworker" />
import { chooseMove } from './search';
import type { ComputerDifficulty, Game } from '../engine/game';
import type { ComputerCommand } from './types';
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = (event: MessageEvent<{ game: Game; difficulty: ComputerDifficulty; preferred?: ComputerCommand }>) => {
  try { scope.postMessage({ decision: chooseMove(event.data.game, event.data.difficulty,event.data.preferred) }); }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : 'Il computer non è riuscito a scegliere una mossa.' }); }
};
