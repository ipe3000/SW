import { computerDifficulty, difficultyLabels } from '../ai/difficulty';
import type { Match } from '../engine/game';
import type { useComputer } from './useComputer';

export function ComputerPanel({ match, busy, control, onPause, onSettings, replaying = false }: { match: Match; busy: boolean; control: ReturnType<typeof useComputer>; onPause?: () => void; onSettings: () => void; replaying?: boolean }) {
  const opponent = match.computer;
  if (!opponent) return null;
  const game = match.game, both = opponent.side === 'both';
  const status = game.stage === 'finished' ? 'Duello concluso' : control.error ? 'Il computer si è fermato' : control.paused ? 'Computer in pausa' : control.presenting ? control.computerTurn ? 'Osserva la sequenza sul campo' : 'Tocca a te' : control.computerTurn ? control.thinking ? 'Il computer sta scegliendo…' : 'Turno del computer' : 'Tocca a te';
  return <section className="computer-card computer-inline" aria-label={both ? 'Computer vs Computer' : 'Avversario didattico'}>
    <p data-testid="computer-state" data-revision={match.revision} role="status">{status}</p>
    <div className="computer-level-summary">
      {both ? <>Rossa · {difficultyLabels[computerDifficulty(match, 'red')]} <span aria-hidden="true">|</span> Blu · {difficultyLabels[computerDifficulty(match, 'blue')]}</> : <>Avversario · {difficultyLabels[computerDifficulty(match, opponent.side === 'red' ? 'red' : 'blue')]}</>}
    </div>
    {game.stage !== 'finished' && !replaying && <div className="button-row"><button className="button secondary" disabled={busy} onClick={onPause ?? control.togglePause}>{control.paused ? 'Riprendi duello' : 'Pausa duello'}</button><button type="button" className="button secondary" disabled={busy} aria-haspopup="dialog" onClick={onSettings}>Impostazioni AI</button>{control.error && <button className="button secondary" disabled={busy} onClick={control.retry}>Riprova</button>}</div>}
    {control.error && <p className="inline-error" role="alert">{control.error}</p>}
  </section>;
}
