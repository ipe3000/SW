import { HomeLanguageSwitch, LanguageSelect, useLanguage } from '../i18n/language';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { GuildBrand } from './GuildBrand';
import { RulesDialog } from './RulesDialog';
import { ExitGameDialog } from './ExitGameDialog';
import { SoundControl } from './SoundControl';

type Section = 'connection' | 'match' | 'settings';
type View = 'closed' | 'menu' | 'rules' | 'exit' | 'tutorial' | Section;
const italianTitles: Record<Section, string> = {
  connection: 'Collegamento online',
  match: 'Partita',
  settings: 'Impostazioni',
};
const MenuContext = createContext<{ menuBody: HTMLDivElement | null; section: Section | null; isOpen: boolean; requestExit: () => void } | null>(null);

export function useGameMenu() {
  const menu = useContext(MenuContext);
  if (!menu) throw new Error('Navigazione di gioco non disponibile.');
  return menu;
}

export function GameNavigation({ inMatch, online = false, busy = false, tutorial = false, suspended = false, waiting = false, returnToMatch = false, onTutorial, onExit, children }: {
  inMatch: boolean; online?: boolean; busy?: boolean; tutorial?: boolean; suspended?: boolean;
  waiting?: boolean; returnToMatch?: boolean; onTutorial?: (fromMatch: boolean) => void; onExit: () => void; children: ReactNode;
}) {
  const [view, setView] = useState<View>('closed');
  const [menuBody, setBody] = useState<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<View | null>(null);
  const wasOpen = useRef(false);
  const section = view === 'connection' || view === 'match' || view === 'settings' ? view : null;
  const showMenu = !suspended && (view === 'menu' || section !== null || view === 'tutorial');

  useEffect(() => {
    const element = dialog.current;
    if (!showMenu || !element) return;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, [showMenu]);

  useEffect(() => {
    if (!showMenu) return;
    const element = dialog.current!;
    element.scrollTop = 0;
    const target = view === 'menu' && returnTo.current
      ? element.querySelector<HTMLElement>(`[data-menu-action="${returnTo.current}"]`)
      : element.querySelector<HTMLElement>(view === 'menu' ? '[data-menu-close]' : '[data-menu-back]');
    returnTo.current = null;
    target?.focus();
  }, [view, showMenu]);

  useEffect(() => {
    const isOpen = view !== 'closed' || suspended;
    if (!isOpen && wasOpen.current) trigger.current?.focus({ preventScroll: true });
    wasOpen.current = isOpen;
  }, [view, suspended]);

  const { language } = useLanguage();
  const english = language === 'en';
  const titles = english ? { connection: 'Online connection', match: 'Match', settings: 'Settings' } : italianTitles;

  function close() { setView('closed'); }
  function requestExit() { setView('exit'); }
  function back() { returnTo.current = view; setView('menu'); }
  function startTutorial() { close(); onTutorial?.(inMatch); }

  const row = (next: View, label: string, disabled = false) =>
    <button className="button secondary full menu-row" data-menu-action={next} disabled={disabled} onClick={() => setView(next)}>{label}<span aria-hidden="true">→</span></button>;

  return <MenuContext value={{ menuBody, section, isOpen: view !== 'closed' || suspended, requestExit }}>
    <header className="topbar">
      <div className="brand-heading"><a className="brand" href="./" aria-label={tutorial ? returnToMatch ? (english ? 'Return to the duel' : 'Torna al duello') : (english ? 'Back to home' : 'Torna alla pagina iniziale') : undefined} onClick={event => { event.preventDefault(); if (tutorial) { if (!busy) onExit(); } else if (inMatch) requestExit(); }}><GuildBrand/></a>{!inMatch && <h1 className="brand-subtitle">{(english ? 'Battle of magical guilds' : 'Battaglia tra gilde magiche')}</h1>}</div>
      <nav aria-label="Navigazione di gioco">
        {tutorial && <button className="text-button" disabled={busy} onClick={onExit}>{returnToMatch ? (english ? 'Return to the duel' : 'Torna al duello') : (english ? 'Exit tutorial' : 'Esci dal tutorial')}</button>}
        {!inMatch && <HomeLanguageSwitch/>}
        {!inMatch && onTutorial && <button className="text-button" data-tutorial-entry onClick={startTutorial}>Tutorial</button>}
        <button ref={trigger} className="text-button" aria-haspopup="dialog" aria-expanded={view !== 'closed'} onClick={() => setView(inMatch ? 'menu' : 'rules')}>{inMatch ? <><span aria-hidden="true">☰</span> {english ? "Menu" : "Menù"}</> : (english ? 'Rules' : 'Regole')}</button>
        <SoundControl/>
      </nav>
    </header>
    {children}
    {showMenu && <dialog ref={dialog} className="game-menu-dialog match-menu" aria-labelledby="game-menu-title" onCancel={event => { event.preventDefault(); close(); }}>
      <header className="game-menu-heading">
        <h2 id="game-menu-title">{section ? titles[section] : view === 'tutorial' ? 'Tutorial' : (english ? 'Menu' : 'Menù')}</h2>
        <button className="button secondary" data-menu-close onClick={close}>{(english ? 'Return to match' : 'Torna alla partita')}</button>
      </header>
      <div className="game-menu-body">
        {view === 'menu' ? <nav className="menu-index" aria-label="Menù partita">
          {onTutorial && row('tutorial', 'Tutorial', busy)}
          {row('rules', (english ? 'Rules and symbols' : 'Regole e simboli'))}
          {online && row('connection', titles.connection)}
          {!tutorial && row('match', titles.match)}
          {!waiting && row('settings', titles.settings)}
          <LanguageSelect/>
          {!tutorial && <div className="game-menu-exit">{row('exit', (english ? 'Back to home' : 'Torna alla pagina iniziale'))}</div>}
        </nav> : <>
          <button className="button secondary menu-back" data-menu-back onClick={back}>{(english ? 'Back' : 'Indietro')}</button>
          {view === 'tutorial' ? <>
            <p>{online ? 'Il duello online resta collegato mentre segui il tutorial. Al ritorno vedrai lo stato aggiornato della partita.' : 'La partita resta aperta. Quando esci dal tutorial ritrovi la scacchiera e la mossa che stavi preparando.'}</p>
            <button className="button primary" disabled={busy} onClick={startTutorial}>{(english ? 'Open tutorial' : 'Apri tutorial')}</button>
          </> : <div ref={setBody}/>}
        </>}
      </div>
    </dialog>}
    {view === 'rules' && <RulesDialog onClose={() => inMatch ? back() : close()} returnToMenu={inMatch}/>}
    {view === 'exit' && <ExitGameDialog online={online} busy={busy} onCancel={close} onConfirm={() => { close(); onExit(); }}/>}
  </MenuContext>;
}
