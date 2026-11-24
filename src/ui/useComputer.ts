import { GameMessageError, formatMessage } from '../i18n/messages';
import { useLanguage } from '../i18n/language';
import { useLayoutEffect, useRef, useState } from 'react';
import type { Activation, Match } from '../engine/game';
import { commitComputerCommand, computerControls } from '../ai/types';
import { computerDifficulty } from '../ai/difficulty';
import { think } from '../ai/client';
import { computerDelay } from '../ai/speed';

export function useComputer(match: Match, save: (next: Match, activation?: Activation) => Promise<void>, busy: boolean, presenting = false) {
  const { language } = useLanguage();
  const [paused, setPaused] = useState(Boolean(match.awaitingResume)), [thinking, setThinking] = useState(false), [error, setError] = useState<GameMessageError | ''>('');
  const current = useRef(match), saveCurrent = useRef(save);
  const pauseRequested = useRef(Boolean(match.awaitingResume));
  const running = useRef<AbortController | null>(null);
  useLayoutEffect(() => { current.current = match; saveCurrent.current = save; }, [match, save]);
  const computerTurn = computerControls(match) && match.game.stage !== 'finished';
  useLayoutEffect(() => {
    if (!computerTurn || paused || error || busy || presenting) { setThinking(false); return; }
    const controller = new AbortController(), original = match;
    running.current = controller;
    let timer: ReturnType<typeof setTimeout>;
    const readableDelay = new Promise<void>(resolve => { timer = setTimeout(resolve, computerDelay(original)); });
    setThinking(true);
    void (async () => {
      try {
        const [decision] = await Promise.all([think(original.game, controller.signal, computerDifficulty(original)), readableDelay]);
        if (pauseRequested.current || controller.signal.aborted || current.current !== original) return;
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
    return () => { running.current = null; controller.abort(); clearTimeout(timer); };
  }, [match, computerTurn, paused, error, busy, presenting]);
  function setPause(value: boolean) {
    pauseRequested.current = value;
    if (value) running.current?.abort();
    setPaused(value);
  }
  return { computerTurn, paused, thinking, presenting, error: error ? formatMessage(error.code, language) : '', setPause, togglePause: () => setPause(!pauseRequested.current), retry: () => setError('') };
}
