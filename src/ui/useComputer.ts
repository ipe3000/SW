import { useEffect, useRef, useState } from 'react';
import type { ComputerSpeed, Match } from '../engine/game';
import { commitComputerCommand, computerControls } from '../ai/types';
import { think } from '../ai/client';
import { computerDelay, setComputerSpeed } from '../ai/speed';

export function useComputer(match: Match, save: (next: Match) => Promise<void>, busy: boolean) {
  const [paused, setPaused] = useState(false), [thinking, setThinking] = useState(false), [error, setError] = useState('');
  const [pendingSpeed, setPendingSpeed] = useState<ComputerSpeed | null>(null), [savingSpeed, setSavingSpeed] = useState(false);
  const requestedSpeed = useRef<ComputerSpeed | null>(null), activeTask = useRef<AbortController | null>(null), settingsWrite = useRef(false), mounted = useRef(true);
  const current = useRef(match), saveCurrent = useRef(save); current.current = match; saveCurrent.current = save;
  const computerTurn = computerControls(match) && match.game.stage !== 'finished';
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!pendingSpeed || busy || settingsWrite.current) return;
    const speed = pendingSpeed;
    settingsWrite.current = true; setSavingSpeed(true);
    void (async () => {
      try { await saveCurrent.current(setComputerSpeed(current.current, speed)); }
      catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Salvataggio della velocità non riuscito.'); }
      finally {
        settingsWrite.current = false;
        if (requestedSpeed.current === speed) { requestedSpeed.current = null; if (mounted.current) setPendingSpeed(null); }
        if (mounted.current) setSavingSpeed(false);
      }
    })();
  }, [match.game.id, match.revision, pendingSpeed, savingSpeed, busy]);
  useEffect(() => {
    if (!computerTurn || paused || error || pendingSpeed || savingSpeed) { setThinking(false); return; }
    const controller = new AbortController(), original = match;
    activeTask.current = controller;
    let timer: ReturnType<typeof setTimeout>;
    const readableDelay = new Promise<void>(resolve => { timer = setTimeout(resolve, computerDelay(original)); });
    setThinking(true);
    void (async () => {
      try {
        const [decision] = await Promise.all([think(original.game, controller.signal), readableDelay]);
        if (controller.signal.aborted || requestedSpeed.current || current.current.game.id !== original.game.id || current.current.revision !== original.revision) return;
        const next = commitComputerCommand(original, decision.command);
        await saveCurrent.current(next);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Il computer si è fermato.');
      } finally { if (!controller.signal.aborted) setThinking(false); }
    })();
    return () => { controller.abort(); clearTimeout(timer); if (activeTask.current === controller) activeTask.current = null; };
  }, [match.game.id, match.revision, computerTurn, paused, error, pendingSpeed, savingSpeed]);
  function changeSpeed(speed: ComputerSpeed) {
    if (match.computer?.side !== 'both' || speed === (match.computer.speed ?? 'normal') && !pendingSpeed) return;
    requestedSpeed.current = speed; activeTask.current?.abort(); setThinking(false); setPendingSpeed(speed);
  }
  return { computerTurn, paused, thinking, error, changingSpeed: Boolean(pendingSpeed) || savingSpeed, speed: pendingSpeed ?? match.computer?.speed ?? 'normal', changeSpeed, togglePause: () => setPaused(value => !value), retry: () => setError('') };
}
