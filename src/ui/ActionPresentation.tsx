import { useLanguage } from '../i18n/language';
import type { Game } from '../engine/game';
import type { Presentation } from '../engine/presentation';
import type { usePresentation } from './usePresentation';
import { presentationText } from './text';
import { useState } from 'react';
import { GameInfoDialog } from './GameInfoDialog';

export function ActionPresentation({ control, change, game, disabled, canReplay, hasReplay = true, showPause = true }: { control: ReturnType<typeof usePresentation>; change: Presentation | null; game: Game; disabled: boolean; canReplay: boolean; hasReplay?: boolean; showPause?: boolean }) {
  const { language } = useLanguage();
  const { frame, last, active, replaying } = control;
  const [details, setDetails] = useState<{ title: string; text: string; resume: boolean } | null>(null);
  const title = active ? frame?.title : last?.summary.join(' ') ?? (change ? `${change.title}. ${change.summary.join(' ')}` : game.log.at(-1) ?? '');
  return <section hidden={!active && !hasReplay} className={`action-presentation ${active ? 'is-playing' : ''}`} aria-label={(language === "en" ? "Action playback" : "Lettura delle azioni")}>
    <div hidden={!active} aria-live="polite" aria-atomic="true" data-testid="action-presentation" data-playing={active} data-replaying={replaying} data-actor={frame?.actorId}>
      <span className="eyebrow">{replaying ? (language === "en" ? "OPPONENT TURN REPLAY" : "REPLAY DEL TURNO AVVERSARIO") : active ? (language === "en" ? "ACTION IN PROGRESS" : "AZIONE IN CORSO") : (language === "en" ? "LAST ACTION" : "ULTIMA AZIONE")}</span>
      <h3 className="action-summary">{presentationText(title ?? '', language)}</h3>
      {active && <><p className="action-detail">{presentationText(frame?.details.join(' ') ?? '', language)}</p>{!replaying && <button className="button ghost action-details-button" onClick={() => { const resume = !control.paused; if (resume) control.togglePause(); setDetails({ title: presentationText(title ?? '', language), text: presentationText(frame?.details.join(' ') ?? '', language), resume }); }}>{(language === "en" ? "Action details" : "Dettagli azione")}</button>}</>}
    </div>
    <div className="presentation-controls">
      {replaying ? <button className="button secondary full" onClick={control.skip}>{(language === "en" ? "Return to match" : "Torna alla partita")}</button> : <>
        {!active && hasReplay && <button className="button secondary full replay-button" disabled={disabled || !canReplay} onClick={control.replay}>{(language === "en" ? "Replay opponent’s last turn" : "Rivedi ultimo turno avversario")}</button>}
        {active && <div className="sequence-controls">
          {control.mode === 'manual' && <button className="button secondary" disabled={control.moving} onClick={control.advance}>{(language === "en" ? "Next event" : "Prossimo evento")}</button>}
          {showPause && <button className="button ghost" onClick={control.togglePause}>{control.paused ? (language === "en" ? "Resume sequence" : "Riprendi sequenza") : (language === "en" ? "Pause sequence" : "Pausa sequenza")}</button>}
          <button className="button ghost" onClick={control.skip}>{(language === "en" ? "Show outcome" : "Mostra esito")}</button>
        </div>}
      </>}
    </div>
    {details && <GameInfoDialog title={details.title} onClose={() => { if (details.resume && active && control.paused) control.togglePause(); setDetails(null); }}><p>{details.text}</p></GameInfoDialog>}
  </section>;
}
