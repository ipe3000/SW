import { useLanguage } from '../i18n/language';
import { type ComputerDifficulties, type ComputerDifficulty, type Side } from '../engine/game';
import { difficultyLabels } from '../ai/difficulty';

export function DifficultySelects({ side, value, onChange, disabled }: {
  side: Side | 'both'; value: ComputerDifficulties; onChange: (value: ComputerDifficulties) => void; disabled?: boolean;
}) {
  const { language } = useLanguage();
  const sides: Side[] = side === 'both' ? ['red', 'blue'] : [side];
  return <fieldset disabled={disabled} className="computer-difficulties">
    <legend>{side === 'both' ? (language === "en" ? "Difficulty" : "Difficoltà") : (language === "en" ? "Opponent difficulty" : "Difficoltà avversario")}</legend>
    {sides.map(color => <label key={color}>
      <span><span className={`seat-dot ${color}`} aria-hidden="true"/>{color === 'red' ? (language === "en" ? "Red Guild" : "Gilda Rossa") : (language === "en" ? "Blue Guild" : "Gilda Blu")}</span>
      <select value={value[color] ?? 'normal'} onChange={event => onChange({ ...value, [color]: event.target.value as ComputerDifficulty })}>
        {Object.entries(difficultyLabels).map(([level, label]) => <option key={level} value={level}>{language === 'en' ? ({ easy: 'Easy', normal: 'Normal', hard: 'Hard' }[level] ?? label) : label}</option>)}
      </select>
    </label>)}
  </fieldset>;
}
