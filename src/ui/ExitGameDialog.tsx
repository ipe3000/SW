import { useEffect, useRef } from 'react';

export function ExitGameDialog({ online = false, busy = false, onCancel, onConfirm }: { online?: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!, previous = document.body.style.overflow;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close(); document.body.style.overflow = previous;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className="exit-game-dialog" aria-labelledby="exit-game-title" aria-describedby="exit-game-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="exit-game-title">Uscire dalla partita?</h2>
    <p id="exit-game-description">Tornerai alla pagina iniziale. La partita resta salvata in questo browser e potrai riprenderla. Le mosse non confermate verranno scartate.</p>
    {online && <p>Il collegamento con l’altro giocatore verrà interrotto. Per continuare dovrete ricollegarvi entrambi.</p>}
    {busy && <p role="status">Salvataggio in corso. Attendi prima di uscire.</p>}
    <div className="exit-game-actions">
      <button autoFocus className="button secondary" onClick={onCancel}>Continua a giocare</button>
      <button className="button primary" disabled={busy} onClick={onConfirm}>Esci e torna all’inizio</button>
    </div>
  </dialog>;
}
