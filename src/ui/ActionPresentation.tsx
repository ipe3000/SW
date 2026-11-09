import type { Game } from '../engine/game';
import type { Presentation } from '../engine/presentation';
import type { usePresentation } from './usePresentation';
import { gameText } from './text';
import { useState } from 'react';
import { GameInfoDialog } from './GameInfoDialog';

export function ActionPresentation({ control, change, game, disabled, canReplay, hasReplay = true, showPause = true }: { control: ReturnType<typeof usePresentation>; change: Presentation | null; game: Game; disabled: boolean; canReplay: boolean; hasReplay?: boolean; showPause?: boolean }) {
  const { frame, last, active, replaying } = control;
  const [details, setDetails] = useState<{ title: string; text: string; resume: boolean } | null>(null);
  const title = active ? frame?.title : last?.summary.join(' ') ?? (change ? `${change.title}. ${change.summary.join(' ')}` : game.log.at(-1) ?? '');
  return <section hidden={!active && !hasReplay} className={`action-presentation ${active ? 'is-playing' : ''}`} aria-label="Lettura delle azioni">
    <div hidden={!active} aria-live="polite" aria-atomic="true" data-testid="action-presentation" data-playing={active} data-replaying={replaying} data-actor={frame?.actorId}>
      <span className="eyebrow">{replaying ? 'REPLAY DEL TURNO AVVERSARIO' : active ? 'AZIONE IN CORSO' : 'ULTIMA AZIONE'}</span>
      <h3 className="action-summary">{gameText(title ?? '')}</h3>
      {active && <><p className="action-detail">{gameText(frame?.details.join(' ') ?? '')}</p>{!replaying && <button className="button ghost action-details-button" onClick={() => { const resume = !control.paused; if (resume) control.togglePause(); setDetails({ title: gameText(title ?? ''), text: gameText(frame?.details.join(' ') ?? ''), resume }); }}>Dettagli azione</button>}</>}
    </div>
    <div className="presentation-controls">
      {replaying ? <button className="button secondary full" onClick={control.skip}>Torna alla partita</button> : <>
        {!active && hasReplay && <button className="button secondary full replay-button" disabled={disabled || !canReplay} onClick={control.replay}>Rivedi ultimo turno avversario</button>}
        {active && <div className="sequence-controls">
          {control.mode === 'manual' && <button className="button secondary" disabled={control.moving} onClick={control.advance}>Prossimo evento</button>}
          {showPause && <button className="button ghost" onClick={control.togglePause}>{control.paused ? 'Riprendi sequenza' : 'Pausa sequenza'}</button>}
          <button className="button ghost" onClick={control.skip}>Mostra esito</button>
        </div>}
      </>}
    </div>
    {details && <GameInfoDialog title={details.title} onClose={() => { if (details.resume && active && control.paused) control.togglePause(); setDetails(null); }}><p>{details.text}</p></GameInfoDialog>}
  </section>;
}
