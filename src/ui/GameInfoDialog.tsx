import { useLanguage } from '../i18n/language';
import { useEffect, useId, useRef, type ReactNode } from 'react';

export function GameInfoDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { language } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => {
    const dialog = ref.current!, trigger = document.activeElement, overflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden';
    return () => {
      dialog.close(); document.body.style.overflow = overflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className="game-menu-dialog game-info-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="game-menu-heading"><h2 id={titleId}>{title}</h2><button autoFocus className="button secondary" onClick={onClose}>{(language === "en" ? "Close" : "Chiudi")}</button></header>
    <div className="game-menu-body">{children}</div>
  </dialog>;
}
