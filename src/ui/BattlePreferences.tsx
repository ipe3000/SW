import { EffectIcon } from './EffectIcon';
import type { useBattleFeedback } from './useBattleFeedback';
export function BattlePreferences({ feedback }: { feedback: ReturnType<typeof useBattleFeedback> }) {
  return <section className="card battle-preferences"><h3>Effetti del duello</h3>
    <button className="button secondary" aria-pressed={feedback.enabled} onClick={() => void feedback.toggleSound()}>{feedback.enabled ? 'Disattiva suoni' : 'Attiva suoni'}</button>
    <label className="effects-volume">Volume effetti<input type="range" min="0" max="100" value={Math.round(feedback.volume * 100)} onChange={e => feedback.changeVolume(Number(e.target.value) / 100)}/></label>
    <label className="checkbox-label"><input type="checkbox" checked={feedback.reduced} disabled={feedback.systemReduced} onChange={e => feedback.changeReduced(e.target.checked)}/>Effetti e movimenti ridotti</label>
    {feedback.systemReduced && <p className="fine-print">Riduzione attiva dalle preferenze del dispositivo.</p>}{feedback.error && <p role="status">{feedback.error}</p>}
    <details><summary>Legenda degli effetti</summary><ul className="effect-legend">{([['damage', 'Cuore spezzato: danno subito.'], ['skull', 'Teschio: mago eliminato.'], ['charm', 'Cuore incatenato: abilità bloccata fino alla fine di questa attivazione, anche allontanandosi.'], ['earth', 'Morsa di terra: movimento proprio bloccato; abilità e spostamenti forzati consentiti.'], ['link', 'Legame interrotto: copia oltre tre caselle, non può agire.'], ['dissolve', 'Frammenti: copia svanita per danni al proprietario.'], ['undo', 'Orologio: annullamento, non guarigione o resurrezione.']] as const).map(([kind, text]) => <li key={kind}><EffectIcon kind={kind}/><span>{text}</span></li>)}</ul></details>
  </section>;
}
