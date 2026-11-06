/// <reference lib="webworker" />
import { didactic } from './didactic';
import type { Game } from '../engine/game';
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = (event: MessageEvent<{ game: Game }>) => {
  try { scope.postMessage({ decision: didactic.choose(event.data.game) }); }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : 'Il computer non è riuscito a scegliere una mossa.' }); }
};
