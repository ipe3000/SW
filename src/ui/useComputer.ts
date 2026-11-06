import { useEffect, useRef, useState } from 'react';
import type { Match } from '../engine/game';
import { commitComputerCommand } from '../ai/types';
import { think } from '../ai/client';

export function useComputer(match: Match, save: (next: Match) => Promise<void>) {
  const [paused, setPaused] = useState(false), [thinking, setThinking] = useState(false), [error, setError] = useState('');
  const current = useRef(match), saveCurrent = useRef(save); current.current = match; saveCurrent.current = save;
  const computerTurn = match.computer?.side === match.game.active && match.game.stage !== 'finished';
  useEffect(() => {
    if (!computerTurn || paused || error) { setThinking(false); return; }
    const controller = new AbortController(), original = match;
    let timer: ReturnType<typeof setTimeout>;
    const readableDelay = new Promise<void>(resolve => { timer = setTimeout(resolve, original.game.stage === 'deployment' ? 350 : 650); });
    setThinking(true);
    void (async () => {
      try {
        const [decision] = await Promise.all([think(original.game, controller.signal), readableDelay]);
        if (controller.signal.aborted || current.current.game.id !== original.game.id || current.current.revision !== original.revision) return;
        const next = commitComputerCommand(original, decision.command);
        await saveCurrent.current(next);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Il computer si è fermato.');
      } finally { if (!controller.signal.aborted) setThinking(false); }
    })();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [match.game.id, match.revision, computerTurn, paused, error]);
  return { computerTurn, paused, thinking, error, togglePause: () => setPaused(value => !value), retry: () => setError('') };
}
