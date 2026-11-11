import { type ComputerDifficulties, type ComputerDifficulty, type Side } from '../engine/game';
import { difficultyLabels } from '../ai/difficulty';

export function DifficultySelects({ side, value, onChange, disabled }: {
  side: Side | 'both'; value: ComputerDifficulties; onChange: (value: ComputerDifficulties) => void; disabled?: boolean;
}) {
  const sides: Side[] = side === 'both' ? ['red', 'blue'] : [side];
  return <fieldset disabled={disabled} className="computer-difficulties">
    <legend>{side === 'both' ? 'Difficoltà' : 'Difficoltà avversario'}</legend>
    {sides.map(color => <label key={color}>
      <span><span className={`seat-dot ${color}`} aria-hidden="true"/>{color === 'red' ? 'Gilda Rossa' : 'Gilda Blu'}</span>
      <select value={value[color] ?? 'normal'} onChange={event => onChange({ ...value, [color]: event.target.value as ComputerDifficulty })}>
        {Object.entries(difficultyLabels).map(([level, label]) => <option key={level} value={level}>{label}</option>)}
      </select>
    </label>)}
  </fieldset>;
}
