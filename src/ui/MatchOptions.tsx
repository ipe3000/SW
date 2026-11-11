import { useLanguage } from '../i18n/language';
import type { Options } from '../engine/game';

export function MatchOptions({ value, onChange }: { value: Options; onChange: (options: Options) => void }) {
  const { language } = useLanguage();
  const standard = value.hp === 4 && value.walls === 'standard' && value.placement === 'standard';
  return <details className="setup-options"><summary>{(language === 'en' ? "Match options" : "Opzioni di partita")}<span>{value.hp} {language === "en" ? "HP" : "PV"} · {standard ? (language === 'en' ? "Standard rules" : "Regole standard") : (language === 'en' ? "Custom rules" : "Personalizzate")}</span></summary>
    <label>{(language === 'en' ? "Starting health" : "Punti vita iniziali")}<select value={value.hp} onChange={e => onChange({ ...value, hp: Number(e.target.value) as Options['hp'] })}><option value={3}>{(language === 'en' ? "3 HP · quick" : "3 PV · rapida")}</option><option value={4}>{(language === 'en' ? "4 HP · standard" : "4 PV · standard")}</option><option value={5}>{(language === 'en' ? "5 HP · durable" : "5 PV · resistente")}</option></select></label>
    <label>{(language === 'en' ? "Force walls" : "Muri di forza")}<select value={value.walls} onChange={e => onChange({ ...value, walls: e.target.value as Options['walls'] })}><option value="standard">{(language === 'en' ? "Standard · two walls, two dice" : "Standard · due muri, due dadi")}</option><option value="varied">{(language === 'en' ? "Alternative · four sectors" : "Alternativa · quattro settori")}</option></select></label>
    <label>{(language === 'en' ? "Deployment" : "Schieramento")}<select value={value.placement} onChange={e => onChange({ ...value, placement: e.target.value as Options['placement'] })}><option value="standard">Standard</option><option value="custom">{(language === 'en' ? "Custom · 4 / 6 / 2 / 2 / 2" : "Personalizzato · 4 / 6 / 2 / 2 / 2")}</option></select></label>
  </details>;
}
