import { useEffect, useRef, useState } from 'react';
import { LocalGame } from './LocalGame';
import { OnlineGame } from './OnlineGame';
import type { GameMode } from './GameModes';
import { TutorialGame } from './TutorialGame';
import { defaultOptions, newMatch } from '../engine/game';
import { saveMatch } from '../game-storage';

/** One mode chooser, including when entering through a friend's invitation. */
export function GameApp({ initialMode }: { initialMode: GameMode }) {
  const [mode, setMode] = useState(initialMode);
  const switched = useRef(false);
  const [tutorial, setTutorial] = useState(false);
  const [localKey, setLocalKey] = useState(0);
  const returnFocus = useRef(false);
  const home = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tutorial && returnFocus.current) {
      returnFocus.current = false;
      home.current?.querySelector<HTMLButtonElement>('[data-tutorial-entry]')?.focus();
    }
  }, [tutorial]);
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
  function exitTutorial() {
    returnFocus.current = true;
    setTutorial(false);
  }
  async function playAfterTutorial() {
    const match = newMatch({ ...defaultOptions, blueName: 'Computer didattico' });
    match.computer = { profile: 'didactic-v1', side: 'blue' };
    await saveMatch(match);
    selectMode('computer');
    sessionStorage.setItem('sw-local-active', match.game.id);
    setLocalKey(key => key + 1);
    setTutorial(false);
  }
  return <>
    <div ref={home} hidden={tutorial}>
      {mode === 'online'
        ? <OnlineGame onModeChange={selectMode} onTutorial={() => setTutorial(true)}/>
        : <LocalGame key={localKey} mode={mode} onModeChange={selectMode} onTutorial={() => setTutorial(true)}/>}
    </div>
    {tutorial && <TutorialGame onExit={exitTutorial} onPlay={playAfterTutorial}/>}
  </>;
}
