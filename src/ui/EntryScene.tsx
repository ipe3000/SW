import { useLanguage } from '../i18n/language';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function EntryScene() {
  const { language } = useLanguage();
  return <section className="entry-scene" aria-labelledby="entry-title">
    <div className="entry-orbit" aria-hidden="true"/>
    <p className="entry-kicker">{language === 'en' ? 'A duel of wit & magic' : 'Un duello di ingegno e magia'}</p>
    <h1 id="entry-title" className="entry-title"><img src={`${import.meta.env.BASE_URL}assets/strategic-wizardry-wordmark-v4.png`} alt="Strategic Wizardry" width="1776" height="888" fetchPriority="high"/></h1>
    <div className="entry-divider" aria-hidden="true"><span>◆</span></div>
    <p className="entry-tagline">{language === 'en' ? 'Battle of magical guilds' : 'Battaglia tra gilde magiche'}</p>
  </section>;
}

export function SavedGames({ items, loading, importer, children }: { items: ReactNode[]; loading: boolean; importer: ReactNode; children?: ReactNode }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current!, previous = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = previous; };
  }, [open]);
  function close() { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
  return <section className="saved-card entry-saves" aria-label="Partite salvate">
    <h2><button ref={trigger} className="resume-games" aria-haspopup="dialog" aria-controls="saved-games-dialog" aria-expanded={open} onClick={() => setOpen(true)}>{(language === 'en' ? "Resume match" : "Riprendi partita")}</button></h2>
    <dialog ref={dialog} id="saved-games-dialog" className="saved-games-dialog" aria-labelledby="saved-games-title" onCancel={event => { event.preventDefault(); close(); }}>
      <header className="saved-games-heading"><h2 id="saved-games-title">{(language === 'en' ? "Resume match" : "Riprendi partita")}</h2><button autoFocus className="button secondary" onClick={close} aria-label="Chiudi partite salvate">{(language === 'en' ? "Close" : "Chiudi")} <span aria-hidden="true">×</span></button></header>
      <div className="saved-games-body" onChangeCapture={event => { if (open && event.target instanceof HTMLInputElement && event.target.type === 'file' && event.target.files?.length) close(); }}>
        {loading ? <p role="status">{(language === 'en' ? "Loading saved matches…" : "Leggo i salvataggi…")}</p> : items.length > 0 ? <ul className="saved-list">{items}</ul> : <p className="empty-saves">{(language === 'en' ? "There are no saved matches in this browser. You can import a match from a file." : "Non ci sono partite salvate in questo browser. Puoi importare una partita da un file.")}</p>}
        <div className="entry-import">{importer}</div>{children}
      </div>
    </dialog>
  </section>;
}
