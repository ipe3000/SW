import { useEffect, useRef, useState } from 'react';
import type { Match } from '../engine/game';
import type { Presentation } from '../engine/presentation';

function readMode(): 'automatic' | 'manual' | 'instant' {
  try { const stored = localStorage.getItem('sw-presentation-mode'); return stored === 'manual' || stored === 'instant' ? stored : 'automatic'; } catch { return 'automatic'; }
}
export function usePresentation(source: Presentation | null, match: Match, opponentTurn: Presentation | null = null) {
  const [mode, setMode] = useState(readMode);
  const [paused, setPaused] = useState(false);
  const [play, setPlay] = useState<{ source: Presentation | null; index: number; done: boolean; replay: boolean; run: number }>({ source: null, index: 0, done: true, replay: false, run: 0 });
  const [finishedMovement, setFinishedMovement] = useState('');
  const previous = useRef(source);
  const [last, setLast] = useState<Presentation | null>(null);
  // Reset during render so neither the AI nor a click can run between a commit and its presentation.
  if (previous.current !== source) {
    previous.current = source;
    setPlay({ source, index: 0, done: !source || mode === 'instant' || source.kind === 'undo', replay: false, run: play.run + 1 });
    setPaused(false);
    if (source?.kind === 'activation') setLast(source);
    if (source?.kind === 'undo') setLast(null);
  }
  const active = Boolean(play.source && !play.done);
  const frame = active ? play.source!.frames[play.index] : null;
  const effectiveMode = play.replay ? 'automatic' : mode;
  const pace = !play.replay && match.computer?.side === 'both' ? match.computer.speed ?? 'normal' : 'normal';
  const ms = pace === 'slowest' ? 1300 : pace === 'slow' ? 850 : pace === 'fast' ? 180 : pace === 'instant' ? 55 : 500;
  const movementKey = `${play.run}:${play.index}`;
  const moving = Boolean(frame?.movement && finishedMovement !== movementKey);
  const movementDuration = Math.max(effectiveMode === 'manual' ? 320 : 100, ms * .85);
  const advance = () => { if (!moving) setPlay(current => ({ ...current, index: Math.min(current.index + 1, (current.source?.frames.length ?? 1) - 1), done: !current.source || current.index + 1 >= current.source.frames.length })); };
  useEffect(() => {
    if (!active || paused || effectiveMode === 'manual' || moving) return;
    const timer = setTimeout(advance, frame!.movement ? Math.max(45, ms * .25) : Math.max(30, ms * frame!.weight));
    return () => clearTimeout(timer);
  }, [active, frame, paused, effectiveMode, ms, moving]);
  function changeMode(value: typeof mode) {
    setMode(value);
    try { localStorage.setItem('sw-presentation-mode', value); } catch { /* Playback still works without preferences storage. */ }
    if (value === 'instant') setPlay(current => current.replay ? current : ({ ...current, done: true }));
  }
  function replay() { if (opponentTurn) { setPaused(false); setPlay(current => ({ source: opponentTurn, index: 0, done: false, replay: true, run: current.run + 1 })); } }
  return { active, frame, mode, changeMode, paused, moving, movementKey, movementDuration, completeMovement: (key: string) => setFinishedMovement(key), togglePause: () => setPaused(value => !value), advance, skip: () => setPlay(current => ({ ...current, done: true })), replay, last, replaying: play.replay && active, index: play.index, total: play.source?.frames.length ?? 0 };
}
