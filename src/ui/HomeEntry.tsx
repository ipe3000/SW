import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HomeLanguageSwitch, useLanguage } from '../i18n/language';
import { EntryScene } from './EntryScene';
import { useGameMenu } from './GameNavigation';
import { useHomePage } from './HomePageState';
import { SoundControl } from './SoundControl';

export function HomeEntry({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const english = language === 'en';
  const { setup, setSetup } = useHomePage();
  const { openRules, startTutorial } = useGameMenu();
  const [languages, setLanguages] = useState(false);
  const play = useRef<HTMLButtonElement>(null);
  const setupPanel = useRef<HTMLDivElement>(null);
  const previousSetup = useRef(setup);
  useEffect(() => {
    if (setup && !previousSetup.current) setupPanel.current?.querySelector<HTMLButtonElement>('.home-back')?.focus();
    if (!setup && previousSetup.current) play.current?.focus();
    previousSetup.current = setup;
  }, [setup]);

  return <main className="local-home fantasy-entry">
    <EntryScene/>
    <nav className="home-menu" aria-label={english ? 'Main menu' : 'Menù principale'} hidden={setup}>
      <button ref={play} className="home-menu-row home-play" onClick={() => setSetup(true)}><span>{english ? 'Play' : 'Gioca'}</span></button>
      <button className="home-menu-row" onClick={openRules}>{english ? 'Rules' : 'Regole'}</button>
      <button className="home-menu-row" data-tutorial-entry onClick={startTutorial}>Tutorial</button>
      <button className="home-menu-row" aria-expanded={languages} aria-controls="home-languages" onClick={() => setLanguages(open => !open)}><span>{english ? 'Language' : 'Lingua'}</span></button>
      <div id="home-languages" className="home-menu-languages" hidden={!languages}><HomeLanguageSwitch/></div>
      <SoundControl homeMenu/>
    </nav>
    <div ref={setupPanel} className="home-setup" hidden={!setup}>
      <button className="home-back" onClick={() => setSetup(false)}>← {english ? 'Main menu' : 'Menù principale'}</button>
      {children}
    </div>
  </main>;
}
