import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { GuildBrand } from './GuildBrand';
import { RulesDialog } from './RulesDialog';
import { ExitGameDialog } from './ExitGameDialog';
import { SoundControl } from './SoundControl';

type View = 'closed' | 'menu' | 'rules' | 'exit';
const MenuContext = createContext<{ menuBody: HTMLDivElement | null; isOpen: boolean; requestExit: () => void; openMenu: () => void } | null>(null);

export function useGameMenu() {
  const menu = useContext(MenuContext);
  if (!menu) throw new Error('Navigazione di gioco non disponibile.');
  return menu;
}

function MenuDialog({ inMatch, setBody, onClose, onRules, onExit, returnTo, scroll }: { inMatch: boolean; setBody: (body: HTMLDivElement | null) => void; onClose: () => void; onRules: () => void; onExit?: () => void; returnTo: 'rules' | 'exit' | null; scroll: RefObject<number> }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!, previous = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden';
    if (returnTo) {
      // The portal containing settings is attached after this dialog mounts.
      const frame = requestAnimationFrame(() => {
        dialog.scrollTop = scroll.current;
        dialog.querySelector<HTMLButtonElement>(`[data-menu-action="${returnTo}"]`)?.focus();
      });
      return () => { cancelAnimationFrame(frame); dialog.close(); document.body.style.overflow = previous; };
    }
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={ref} id="play-menu" className="game-menu-dialog match-menu" aria-labelledby="game-menu-title" onScroll={event => { scroll.current = event.currentTarget.scrollTop; }} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="game-menu-heading"><h2 id="game-menu-title">Menù</h2><button autoFocus className="button secondary" onClick={onClose} aria-label="Chiudi menù">Chiudi <span aria-hidden="true">×</span></button></header>
    <div className="game-menu-body">
      {inMatch ? <div ref={setBody}/> : <p>Scegli la modalità dalla pagina iniziale. Durante la partita troverai qui impostazioni, salvataggi e collegamento online.</p>}
      <section className="game-menu-navigation" aria-label="Regole e navigazione">
        <button className="button secondary full" data-menu-action="rules" onClick={onRules}>Regole del gioco <span aria-hidden="true">→</span></button>
        {onExit && <div className="game-menu-exit"><button className="button secondary full" data-menu-action="exit" onClick={onExit}>Esci dal gioco <span aria-hidden="true">→</span></button><p>Ritorna alla pagina iniziale. Ti verrà chiesta conferma.</p></div>}
      </section>
    </div>
  </dialog>;
}

/** One navigation entry and one modal at a time, shared by all game modes. */
export function GameNavigation({ inMatch, online = false, busy = false, tutorial = false, onTutorial, onExit, children }: { inMatch: boolean; online?: boolean; busy?: boolean; tutorial?: boolean; onTutorial?: () => void; onExit: () => void; children: ReactNode }) {
  const [view, setView] = useState<View>('closed');
  const [menuBody, setMenuBody] = useState<HTMLDivElement | null>(null);
  const [returnTo, setReturnTo] = useState<'rules' | 'exit' | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const scroll = useRef(0);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (view === 'closed' && wasOpen.current) button.current?.focus({ preventScroll: true });
    wasOpen.current = view !== 'closed';
  }, [view]);
  function close() { setView('closed'); }
  function openMenu() { scroll.current = 0; setReturnTo(null); setView('menu'); }
  function requestExit() { setReturnTo('exit'); setView('exit'); }
  return <MenuContext value={{ menuBody, isOpen: view !== 'closed', requestExit, openMenu }}>
    <header className="topbar"><div className="brand-heading"><a className="brand" href="./" aria-label={tutorial ? 'Torna alla pagina iniziale' : undefined} onClick={event => { event.preventDefault(); if (tutorial) { if (!busy) onExit(); } else if (inMatch) requestExit(); }}><GuildBrand/></a>{!inMatch && <h1 className="brand-subtitle">Battaglia tra gilde magiche</h1>}</div><nav aria-label="Navigazione di gioco">{tutorial && <button className="text-button" disabled={busy} onClick={onExit}>Esci dal tutorial</button>}{!inMatch && onTutorial && <button className="text-button" data-tutorial-entry onClick={onTutorial}>Tutorial</button>}<button ref={button} className="text-button" aria-haspopup="dialog" aria-controls={inMatch ? 'play-menu' : undefined} aria-expanded={view !== 'closed'} onClick={inMatch ? openMenu : () => setView('rules')}>{inMatch ? <><span aria-hidden="true">☰</span> Menù</> : 'Regole'}</button><SoundControl/></nav></header>
    {children}
    {view === 'menu' && <MenuDialog inMatch={inMatch} setBody={setMenuBody} onClose={close} returnTo={returnTo} scroll={scroll} onRules={() => { setReturnTo('rules'); setView('rules'); }} onExit={inMatch && !tutorial ? requestExit : undefined}/>}
    {view === 'rules' && <RulesDialog onClose={() => setView(inMatch ? 'menu' : 'closed')} returnToMenu={inMatch}/>}
    {view === 'exit' && <ExitGameDialog online={online} busy={busy} onCancel={() => setView('menu')} onConfirm={() => { close(); onExit(); }}/>}
  </MenuContext>;
}
