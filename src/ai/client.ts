import type { ComputerDifficulty, Game } from '../engine/game';
import type { ComputerDecision, ComputerPlan } from './types';
import { decisionPosition } from './position';
import { localHardWeights } from './local-profile';

let previousPlan: { difficulty: ComputerDifficulty; profileKey: string | undefined; steps: ComputerPlan } | undefined;

/** A disposable worker makes navigation/cancellation discard all stale results. */
export function think(game: Game, signal: AbortSignal, difficulty: ComputerDifficulty): Promise<ComputerDecision> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Calcolo interrotto.', 'AbortError')); return; }
    const hardProfile = localHardWeights(game, difficulty);
    const profileKey = hardProfile && JSON.stringify(hardProfile);
    let worker: Worker;
    try { worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }); }
    catch { reject(new Error('Non è possibile avviare il computer in questo browser. Prova a riaprire la partita.')); return; }
    const cleanup = () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(new DOMException('Calcolo interrotto.', 'AbortError')); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Il computer sta impiegando troppo tempo. Metti in pausa e riprova.')); }, 20000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.decision?.command) {
        previousPlan={ difficulty, profileKey, steps:event.data.decision.continuation ?? [] };
        resolve(event.data.decision);
      }
      else reject(new Error('Il computer ha restituito una risposta non valida.'));
    };
    worker.onerror = () => { cleanup(); reject(new Error('Il calcolo del computer si è interrotto. Puoi riprovare o riaprire la partita.')); };
    const preferred=previousPlan?.difficulty===difficulty && previousPlan.profileKey === profileKey
      ? previousPlan.steps.find(step=>step.position===decisionPosition(game))?.command : undefined;
    worker.postMessage({ game, difficulty, preferred, hardProfile });
  });
}
