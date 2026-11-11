import { formatMessage } from '../i18n/messages';
import { useLanguage } from '../i18n/language';
import { EffectIcon } from './EffectIcon';
import type { useBattleFeedback } from './useBattleFeedback';
export function BattlePreferences({ feedback }: { feedback: ReturnType<typeof useBattleFeedback> }) {
  const { language } = useLanguage();
  return <section className="card battle-preferences"><h3>{(language === "en" ? "Duel effects" : "Effetti del duello")}</h3>
    <button className="button secondary" aria-pressed={feedback.enabled} onClick={() => void feedback.toggleSound()}>{feedback.enabled ? (language === "en" ? "Mute sounds" : "Disattiva suoni") : (language === "en" ? "Enable sounds" : "Attiva suoni")}</button>
    <label className="effects-volume">{(language === "en" ? "Effects volume" : "Volume effetti")}<input type="range" min="0" max="100" value={Math.round(feedback.volume * 100)} onChange={e => feedback.changeVolume(Number(e.target.value) / 100)}/></label>
    <label className="checkbox-label"><input type="checkbox" checked={feedback.reduced} disabled={feedback.systemReduced} onChange={e => feedback.changeReduced(e.target.checked)}/>{(language === "en" ? "Reduce motion and effects" : "Effetti e movimenti ridotti")}</label>
    {feedback.systemReduced && <p className="fine-print">{(language === "en" ? "Reduced motion is enabled by your device settings." : "Riduzione attiva dalle preferenze del dispositivo.")}</p>}{feedback.error && <p role="status">{formatMessage(feedback.error, language)}</p>}
  </section>;
}

export function EffectLegend() {
  const { language } = useLanguage();
  return <ul className="effect-legend">{([['damage', (language === "en" ? "Broken heart: damage taken." : "Cuore spezzato: danno subito.")], ['skull', (language === "en" ? "Skull: mage removed." : "Teschio: mago eliminato.")], ['charm', (language === "en" ? "Chained heart: ability blocked until this activation ends, even after moving away." : "Cuore incatenato: abilità bloccata fino alla fine di questa attivazione, anche allontanandosi.")], ['earth', (language === "en" ? "Earth Grasp: walking blocked. Abilities and forced movement are allowed." : "Morsa di terra: movimento proprio bloccato; abilità e spostamenti forzati consentiti.")], ['link', (language === "en" ? "Broken bond: the copy is more than three squares away and cannot act." : "Legame interrotto: copia oltre tre caselle, non può agire.")], ['dissolve', (language === "en" ? "Fragments: the copy vanished after its owner took damage." : "Frammenti: copia svanita per danni al proprietario.")], ['undo', (language === "en" ? "Clock: action undone. No healing or resurrection." : "Orologio: annullamento, non guarigione o resurrezione.")]] as const).map(([kind, text]) => <li key={kind}><EffectIcon kind={kind}/><span>{text}</span></li>)}</ul>;
}
