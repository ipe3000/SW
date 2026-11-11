import { useLanguage } from '../i18n/language';
import type { ComputerSpeed } from '../engine/game';
import { COMPUTER_SPEEDS } from '../ai/speed';

export function ComputerSpeedSelect({ id, value, disabled = false, onChange }: { id: string; value: ComputerSpeed; disabled?: boolean; onChange: (speed: ComputerSpeed) => void }) {
  const { language } = useLanguage();
  return <div className="computer-speed"><label htmlFor={id}>{(language === "en" ? "Playback speed" : "Velocità di riproduzione")}</label><select id={id} value={value} disabled={disabled} onChange={event => onChange(event.target.value as ComputerSpeed)}>{COMPUTER_SPEEDS.map(option => <option key={option.id} value={option.id}>{language === 'en' ? { slowest: 'Slowest', slow: 'Slow', normal: 'Normal', fast: 'Fast', instant: 'Instant' }[option.id] : option.label}</option>)}</select><p className="fine-print">Attesa minima prima di ogni fase. Regola anche il ritmo delle sequenze automatiche; «Riproduzione» permette di seguirle passo per passo.</p></div>;
}
