import type { Game } from '../engine/game';
import type { Presentation } from '../engine/presentation';
import type { usePresentation } from './usePresentation';
import { gameText } from './text';

export function ActionPresentation({ control, change, game, disabled, canReplay, showPause = true }: { control: ReturnType<typeof usePresentation>; change: Presentation | null; game: Game; disabled: boolean; canReplay: boolean; showPause?: boolean }) {
  const { frame, last, active, replaying } = control;
  const title = replaying ? 'Replay del turno avversario' : active ? frame?.title : last?.summary.join(' ') ?? (change ? `${change.title}. ${change.summary.join(' ')}` : game.log.at(-1) ?? 'Seleziona un mago per iniziare.');
  return <section className={`action-presentation ${active ? 'is-playing' : ''}`} aria-label="Lettura delle azioni">
    <div aria-live="polite" aria-atomic="true" data-testid="action-presentation" data-playing={active} data-replaying={replaying} data-actor={frame?.actorId}>
      <span className="eyebrow">{replaying ? 'REPLAY DEL TURNO AVVERSARIO' : active ? 'AZIONE IN CORSO' : 'ULTIMA AZIONE'}</span>
      <h3 className="action-summary">{gameText(title ?? '')}</h3>
      {active && <p className="action-detail">{gameText(frame?.details.join(' ') ?? '')}</p>}
    </div>
    <div className="presentation-controls">
      {replaying ? <button className="button secondary full" onClick={control.skip}>Torna alla partita</button> : <>
        <button className="button secondary full" disabled={disabled || active || !canReplay} onClick={control.replay}>Rivedi ultimo turno avversario</button>
        {active && <div className="sequence-controls">
          {control.mode === 'manual' && <button className="button secondary" disabled={control.moving} onClick={control.advance}>Prossimo evento</button>}
          {showPause && <button className="button ghost" onClick={control.togglePause}>{control.paused ? 'Riprendi sequenza' : 'Pausa sequenza'}</button>}
          <button className="button ghost" onClick={control.skip}>Mostra esito</button>
        </div>}
      </>}
    </div>
  </section>;
}
