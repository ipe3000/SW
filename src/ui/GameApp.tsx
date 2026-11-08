import { useEffect, useRef, useState } from 'react';
import { LocalGame } from './LocalGame';
import { OnlineGame } from './OnlineGame';
import type { GameMode } from './GameModes';

/** One mode chooser, including when entering through a friend's invitation. */
export function GameApp({ initialMode }: { initialMode: GameMode }) {
  const [mode, setMode] = useState(initialMode);
  const switched = useRef(false);
  useEffect(() => {
    if (switched.current) document.querySelector<HTMLInputElement>(`.mode-choice input[value="${mode}"]`)?.focus({ preventScroll: true });
  }, [mode]);
  function selectMode(next: GameMode) {
    switched.current = true;
    const url = new URL(location.href);
    if (next === 'online') url.searchParams.set('online', '1');
    else {
      url.searchParams.delete('online');
      if (url.hash.startsWith('#duello=')) url.hash = '';
      if (mode === 'online') sessionStorage.removeItem('sw-local-active');
    }
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    setMode(next);
  }
  return mode === 'online' ? <OnlineGame onModeChange={selectMode}/> : <LocalGame mode={mode} onModeChange={selectMode}/>;
}
