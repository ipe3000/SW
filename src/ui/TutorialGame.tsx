import { GameMessageError, formatMessage } from '../i18n/messages';
import { useLanguage } from '../i18n/language';
import { useEffect, useRef, useState } from 'react';
import { presentChange, type Presentation } from '../engine/presentation';
import type { Activation, Match } from '../engine/game';
import { GameNavigation } from './GameNavigation';
import { GameScreen } from './LocalGame';
import { createLesson, type Lesson } from './tutorial-lessons';

export function TutorialGame({ onExit, onPlay }: { onExit: () => void; onPlay?: () => Promise<void> }) {
  const { language } = useLanguage();
  const [lesson, setLesson] = useState<Lesson>(0);
  const [match, setMatch] = useState(() => createLesson(0));
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<GameMessageError | ''>('');
  const shell = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    shell.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, [match.game.id]);

  function open(next: Lesson) {
    setLesson(next);
    setPresentation(null);
    setError('');
    setMatch(createLesson(next));
  }

  async function save(next: Match, activation?: Activation) {
    setPresentation(presentChange(match, next, activation));
    setMatch(next);
  }

  async function play() {
    if (!onPlay) return;
    setStarting(true);
    setError('');
    try { await onPlay(); }
    catch (e) { setError(e instanceof GameMessageError ? e : new GameMessageError('tutorialStartFailed')); setStarting(false); }
  }

  return <div ref={shell} className="app-shell local-app in-match tutorial-app">
    <GameNavigation inMatch tutorial returnToMatch={!onPlay} busy={starting} onExit={onExit}>
      <GameScreen key={match.game.id} match={match} presentation={presentation} save={save} busy={starting}
        tutorial={{ lesson, retry: () => open(lesson), next: () => { if (lesson !== 3) open((lesson + 1) as Lesson); }, play: onPlay ? play : undefined, exit: onExit, error: error ? formatMessage(error.code, language) : '' }}/>
    </GameNavigation>
  </div>;
}
