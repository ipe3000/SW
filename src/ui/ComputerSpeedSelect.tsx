import type { ComputerSpeed } from '../engine/game';
import { COMPUTER_SPEEDS } from '../ai/speed';

export function ComputerSpeedSelect({ id, value, disabled = false, onChange }: { id: string; value: ComputerSpeed; disabled?: boolean; onChange: (speed: ComputerSpeed) => void }) {
  return <div className="computer-speed"><label htmlFor={id}>Velocità dei computer</label><select id={id} value={value} disabled={disabled} onChange={event => onChange(event.target.value as ComputerSpeed)}>{COMPUTER_SPEEDS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select><p className="fine-print">Attesa minima prima di ogni fase, anche durante lo schieramento.</p></div>;
}
