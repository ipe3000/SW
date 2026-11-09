import { useEffect, useRef, useState, type ReactNode } from 'react';

export function EntryScene() {
  return <section className="entry-scene" aria-label="Due maghi si sfidano su una scacchiera magica">
    <div className="entry-artwork"><img src={`${import.meta.env.BASE_URL}assets/guild-strategy-entry.webp`} alt="Una maga rossa e un mago blu giocano su una scacchiera magica, tra antiche arcate." width="1254" height="1254" fetchPriority="high"/></div>
  </section>;
}

export function SavedGames({ items, loading, importer, children }: { items: ReactNode[]; loading: boolean; importer: ReactNode; children?: ReactNode }) {
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
    <h2><button ref={trigger} className="resume-games" aria-haspopup="dialog" aria-controls="saved-games-dialog" aria-expanded={open} onClick={() => setOpen(true)}>Riprendi partita</button></h2>
    <dialog ref={dialog} id="saved-games-dialog" className="saved-games-dialog" aria-labelledby="saved-games-title" onCancel={event => { event.preventDefault(); close(); }}>
      <header className="saved-games-heading"><h2 id="saved-games-title">Riprendi partita</h2><button autoFocus className="button secondary" onClick={close} aria-label="Chiudi partite salvate">Chiudi <span aria-hidden="true">×</span></button></header>
      <div className="saved-games-body" onChangeCapture={event => { if (open && event.target instanceof HTMLInputElement && event.target.type === 'file' && event.target.files?.length) close(); }}>
        {loading ? <p role="status">Leggo i salvataggi…</p> : items.length > 0 ? <ul className="saved-list">{items}</ul> : <p className="empty-saves">Non ci sono partite salvate in questo browser. Puoi importare una partita da un file.</p>}
        <div className="entry-import">{importer}</div>{children}
      </div>
    </dialog>
  </section>;
}
