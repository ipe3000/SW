import type { Match } from '../engine/game';
import type { useComputer } from './useComputer';

export function ComputerPanel({ match, busy, control, onPause, replaying = false }: { match: Match; busy: boolean; control: ReturnType<typeof useComputer>; onPause?: () => void; replaying?: boolean }) {
  const opponent = match.computer;
  if (!opponent) return null;
  const game = match.game, both = opponent.side === 'both';
  const status = game.stage === 'finished' ? 'Duello concluso' : control.changingSpeed ? 'Salvo la velocità…' : control.error ? 'Il computer si è fermato' : control.paused ? 'Computer in pausa' : control.presenting ? control.computerTurn ? 'Osserva la sequenza sul campo' : 'Tocca a te' : control.computerTurn ? control.thinking ? 'Il computer sta scegliendo…' : 'Turno del computer' : 'Tocca a te';
  return <section className="computer-card computer-inline" aria-label={both ? 'Computer vs Computer' : 'Avversario didattico'}>
    <p data-testid="computer-state" data-revision={match.revision} role="status">{status}</p>
    {game.stage !== 'finished' && !replaying && <div className="button-row"><button className="button secondary" disabled={busy || control.changingSpeed} onClick={onPause ?? control.togglePause}>{control.paused ? 'Riprendi duello' : 'Pausa duello'}</button>{control.error && <button className="button secondary" disabled={busy || control.changingSpeed} onClick={control.retry}>Riprova</button>}</div>}
    {control.error && <p className="inline-error" role="alert">{control.error}</p>}
  </section>;
}
