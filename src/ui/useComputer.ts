import { GameMessageError, formatMessage } from '../i18n/messages';
import { useLanguage } from '../i18n/language';
import { useEffect, useRef, useState } from 'react';
import type { Activation, Match } from '../engine/game';
import { commitComputerCommand, computerControls } from '../ai/types';
import { computerDifficulty } from '../ai/difficulty';
import { think } from '../ai/client';
import { computerDelay } from '../ai/speed';

export function useComputer(match: Match, save: (next: Match, activation?: Activation) => Promise<void>, busy: boolean, presenting = false) {
  const { language } = useLanguage();
  const [paused, setPaused] = useState(false), [thinking, setThinking] = useState(false), [error, setError] = useState<GameMessageError | ''>('');
  const current = useRef(match), saveCurrent = useRef(save); current.current = match; saveCurrent.current = save;
  const computerTurn = computerControls(match) && match.game.stage !== 'finished';
  useEffect(() => {
    if (!computerTurn || paused || error || busy || presenting) { setThinking(false); return; }
    const controller = new AbortController(), original = match;
    let timer: ReturnType<typeof setTimeout>;
    const readableDelay = new Promise<void>(resolve => { timer = setTimeout(resolve, computerDelay(original)); });
    setThinking(true);
    void (async () => {
      try {
        const [decision] = await Promise.all([think(original.game, controller.signal, computerDifficulty(original)), readableDelay]);
        if (controller.signal.aborted || current.current.game.id !== original.game.id || current.current.revision !== original.revision) return;
        const next = commitComputerCommand(original, decision.command);
        try {
          await saveCurrent.current(next, decision.command.kind === 'activate' ? decision.command.activation : undefined);
        } catch (failure) {
          if (current.current === original) setError(failure instanceof GameMessageError ? failure : new GameMessageError('computerSaveFailed'));
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof GameMessageError ? e : new GameMessageError('computerMoveFailed'));
      } finally { if (!controller.signal.aborted) setThinking(false); }
    })();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [match.game.id, match.revision, computerTurn, paused, error, busy, presenting]);
  return { computerTurn, paused, thinking, presenting, error: error ? formatMessage(error.code, language) : '', togglePause: () => setPaused(value => !value), retry: () => setError('') };
}
