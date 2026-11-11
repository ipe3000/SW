import { useLanguage } from '../i18n/language';
import { useEffect, useRef } from 'react';

export function ExitGameDialog({ online = false, busy = false, onCancel, onConfirm }: { online?: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { language } = useLanguage();
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
    <h2 id="exit-game-title">{(language === "en" ? "Leave the match?" : "Uscire dalla partita?")}</h2>
    <p id="exit-game-description">{(language === "en" ? "You will return to the home page. You can resume the saved match in this browser. Unconfirmed moves will be discarded." : "Tornerai alla pagina iniziale. La partita resta salvata in questo browser e potrai riprenderla. Le mosse non confermate verranno scartate.")}</p>
    {online && <p>{(language === "en" ? "You will disconnect from the other player. Both players need to reconnect to continue." : "Il collegamento con l’altro giocatore verrà interrotto. Per continuare dovrete ricollegarvi entrambi.")}</p>}
    {busy && <p role="status">{(language === "en" ? "Saving the match. Wait before leaving." : "Salvataggio in corso. Attendi prima di uscire.")}</p>}
    <div className="exit-game-actions">
      <button autoFocus className="button secondary" onClick={onCancel}>{(language === "en" ? "Keep playing" : "Continua a giocare")}</button>
      <button className="button primary" disabled={busy} onClick={onConfirm}>{(language === "en" ? "Leave and return home" : "Esci e torna all’inizio")}</button>
    </div>
  </dialog>;
}
