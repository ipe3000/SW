import type { ReactNode } from 'react';

export function EntryScene() {
  return <section className="entry-scene" aria-label="Una radura tra le antiche rovine">
    <img src={`${import.meta.env.BASE_URL}assets/fantasy-realism-entry.webp`} alt="" fetchPriority="high"/>
    <div className="entry-scene-caption"><h1>Otto maghi.<br/>Una strategia.</h1><p>Il duello delle gilde</p></div>
  </section>;
}

export function SavedGames({ items, loading, importer, children }: { items: ReactNode[]; loading: boolean; importer: ReactNode; children?: ReactNode }) {
  return <section className="saved-card entry-saves" aria-label="Partite salvate">
    {loading ? <p role="status">Leggo i salvataggi…</p> : items.length > 0 && <><h2>Riprendi ultima partita</h2><ul className="saved-list">{items.slice(0, 1)}</ul>{items.length > 1 && <details className="all-saves"><summary>Tutte le partite ({items.length})</summary><ul className="saved-list">{items.slice(1)}</ul></details>}</>}
    <div className="entry-import">{importer}</div>{children}
  </section>;
}
