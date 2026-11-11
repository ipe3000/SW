import { useLanguage } from '../i18n/language';
import { computerDifficulty, difficultyLabels } from '../ai/difficulty';
import type { Match } from '../engine/game';
import type { useComputer } from './useComputer';

export function ComputerPanel({ match, busy, control, onPause, onSettings, replaying = false }: { match: Match; busy: boolean; control: ReturnType<typeof useComputer>; onPause?: () => void; onSettings: () => void; replaying?: boolean }) {
  const { language } = useLanguage();
  const opponent = match.computer;
  if (!opponent) return null;
  const game = match.game, both = opponent.side === 'both';
  const status = game.stage === 'finished' ? (language === "en" ? "Duel complete" : "Duello concluso") : control.error ? (language === "en" ? "The computer stopped" : "Il computer si è fermato") : control.paused ? (language === "en" ? "Computer paused" : "Computer in pausa") : control.presenting ? control.computerTurn ? (language === "en" ? "Watch the sequence on the board" : "Osserva la sequenza sul campo") : (language === "en" ? "Your turn" : "Tocca a te") : control.computerTurn ? control.thinking ? (language === "en" ? "The computer is choosing…" : "Il computer sta scegliendo…") : (language === "en" ? "Computer’s turn" : "Turno del computer") : (language === "en" ? "Your turn" : "Tocca a te");
  return <section className="computer-card computer-inline" aria-label={both ? 'Computer vs Computer' : (language === "en" ? "Computer opponent" : "Avversario didattico")}>
    <p data-testid="computer-state" data-revision={match.revision} role="status">{status}</p>
    <div className="computer-level-summary">
      {both ? <>Rossa · {difficultyLabels[computerDifficulty(match, 'red')]} <span aria-hidden="true">|</span> Blu · {difficultyLabels[computerDifficulty(match, 'blue')]}</> : <>Avversario · {difficultyLabels[computerDifficulty(match, opponent.side === 'red' ? 'red' : 'blue')]}</>}
    </div>
    {game.stage !== 'finished' && !replaying && <div className="button-row"><button className="button secondary" disabled={busy} onClick={onPause ?? control.togglePause}>{control.paused ? (language === "en" ? "Resume duel" : "Riprendi duello") : (language === "en" ? "Pause duel" : "Pausa duello")}</button><button type="button" className="button secondary" disabled={busy} aria-haspopup="dialog" onClick={onSettings}>{(language === "en" ? "AI settings" : "Impostazioni AI")}</button>{control.error && <button className="button secondary" disabled={busy} onClick={control.retry}>{(language === "en" ? "Retry" : "Riprova")}</button>}</div>}
    {control.error && <p className="inline-error" role="alert">{control.error}</p>}
  </section>;
}
