import { other, sideName, type Match } from '../engine/game';
import type { useComputer } from './useComputer';

export function ComputerPanel({ match, busy, control, onPause, replaying = false }: { match: Match; busy: boolean; control: ReturnType<typeof useComputer>; onPause?: () => void; replaying?: boolean }) {
  const opponent = match.computer;
  if (!opponent) return null;
  const game = match.game, both = opponent.side === 'both', color = opponent.side === 'both' ? game.active : opponent.side;
  const status = game.stage === 'finished' ? 'Duello concluso' : control.changingSpeed ? 'Salvo la velocità…' : control.error ? 'Il computer si è fermato' : control.paused ? 'Computer in pausa' : control.presenting ? 'Osserva la sequenza sul campo' : control.computerTurn ? control.thinking ? 'Il computer sta scegliendo…' : 'Turno del computer' : 'Tocca a te';
  return <section className="card computer-card">
    <div className="card-title"><h3>{both ? 'Computer vs Computer' : 'Avversario didattico'}</h3><span className={`guild-label ${color}`}>{sideName(color)}</span></div>
    <p data-testid="computer-state" data-revision={match.revision} role="status">{status}</p>
    {opponent.side !== 'both' && <p className="fine-print">Giochi con il {sideName(other(opponent.side))}.</p>}
    {game.stage !== 'finished' && !replaying && <div className="button-row"><button className="button secondary" disabled={busy || control.changingSpeed} onClick={onPause ?? control.togglePause}>{control.paused ? 'Riprendi duello' : 'Pausa duello'}</button>{control.error && <button className="button secondary" disabled={busy || control.changingSpeed} onClick={control.retry}>Riprova</button>}</div>}
    {control.error && <p className="inline-error" role="alert">{control.error}</p>}
  </section>;
}
