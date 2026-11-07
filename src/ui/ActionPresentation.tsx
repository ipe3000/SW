import type { Game } from '../engine/game';
import type { Presentation } from '../engine/presentation';
import type { usePresentation } from './usePresentation';

export function ActionPresentation({ control, change, game, disabled }: { control: ReturnType<typeof usePresentation>; change: Presentation | null; game: Game; disabled: boolean }) {
  const { frame, last, active } = control;
  return <section className={`action-presentation ${active ? 'is-playing' : ''}`} aria-label="Lettura delle azioni">
    <div className="presentation-heading"><span className="eyebrow">{control.replaying ? 'RIVEDI · SOLO VISUALIZZAZIONE' : active ? `SEQUENZA · ${control.index + 1} / ${control.total}` : last ? 'ULTIMA ATTIVAZIONE' : 'ULTIMO EVENTO'}</span><label>Riproduzione<select aria-label="Riproduzione delle azioni" value={control.mode} onChange={e => control.changeMode(e.target.value as typeof control.mode)}><option value="automatic">Automatica</option><option value="manual">Passo per passo</option><option value="instant">Immediata</option></select></label></div>
    <div aria-live="polite" aria-atomic="true" data-testid="action-presentation" data-playing={active}>
      <h3>{frame?.title ?? last?.title ?? change?.title ?? 'Segui il duello'}</h3>
      <ul>{(frame?.details ?? last?.summary ?? change?.summary ?? [game.log.at(-1) ?? 'Le attivazioni confermate verranno mostrate qui.']).map((detail, i) => <li key={i}>{detail}</li>)}</ul>
    </div>
    {!active && change && change.kind !== 'activation' && last && <p className="presentation-change">{change.title}{change.summary.length > 1 ? ` · ${change.summary.slice(1).join(' ')}` : ''}</p>}
    <div className="presentation-controls">
      {active ? <><button className="button secondary" onClick={control.advance}>Prossimo evento →</button>{control.mode !== 'manual' && <button className="button ghost" onClick={control.togglePause}>{control.paused ? 'Riprendi sequenza' : 'Pausa sequenza'}</button>}<button className="button ghost" onClick={control.skip}>Mostra esito</button></> : <button className="button secondary" disabled={!last || disabled} onClick={control.replay}>Rivedi ultima attivazione</button>}
    </div>
    <p className="fine-print">{active ? 'La prossima azione attende la fine della sequenza.' : 'Il replay non modifica la partita. Cronaca completa sotto il campo.'}</p>
  </section>;
}
