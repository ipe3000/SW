import { other, sideName, type Match } from '../engine/game';
import type { useComputer } from './useComputer';
import { ComputerSpeedSelect } from './ComputerSpeedSelect';

export function ComputerPanel({ match, busy, control }: { match: Match; busy: boolean; control: ReturnType<typeof useComputer> }) {
  const opponent = match.computer;
  if (!opponent) return null;
  const game = match.game, both = opponent.side === 'both', color = opponent.side === 'both' ? game.active : opponent.side;
  const status = game.stage === 'finished' ? 'Duello concluso' : control.changingSpeed ? 'Salvo la velocità…' : control.error ? 'Il computer si è fermato' : control.paused ? 'Computer in pausa' : control.presenting ? 'Osserva la sequenza sul campo' : control.computerTurn ? control.thinking ? 'Il computer sta scegliendo…' : 'Turno del computer' : 'Tocca a te';
  return <section className="card computer-card">
    <div className="card-title"><h3>{both ? 'Computer vs Computer' : 'Avversario didattico'}</h3><span className={`guild-label ${color}`}>{sideName(color)}</span></div>
    <p data-testid="computer-state" data-revision={match.revision} role="status">{status}</p>
    <p className="fine-print">{opponent.side === 'both' ? 'Entrambe le gilde giocano automaticamente. Puoi osservare il campo, mettere in pausa e riprendere.' : `Giochi con il ${sideName(other(opponent.side))}. Le tue attivazioni sono annullabili fino a «Termina turno».`}</p>
    {both && <ComputerSpeedSelect id="game-computer-speed" value={control.speed} disabled={control.changingSpeed || game.stage === 'finished'} onChange={control.changeSpeed}/>}
    {game.stage !== 'finished' && <div className="button-row"><button className="button secondary" disabled={busy || control.changingSpeed} onClick={control.togglePause}>{control.paused ? 'Riprendi computer' : 'Metti in pausa il computer'}</button>{control.error && <button className="button secondary" disabled={busy || control.changingSpeed} onClick={control.retry}>Riprova</button>}</div>}
    {control.error && <p className="inline-error" role="alert">{control.error}</p>}
  </section>;
}
