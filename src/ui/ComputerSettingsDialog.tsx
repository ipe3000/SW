import { useState } from 'react';
import type { ComputerDifficulties, ComputerOpponent, ComputerSpeed } from '../engine/game';
import { GameInfoDialog } from './GameInfoDialog';
import { DifficultySelects } from './DifficultySelects';
import { ComputerSpeedSelect } from './ComputerSpeedSelect';

export function ComputerSettingsDialog({ opponent, onClose, onApply, busy }: {
  opponent: ComputerOpponent; onClose: () => void; onApply: (opponent: ComputerOpponent) => Promise<void>; busy: boolean;
}) {
  const [difficulty, setDifficulty] = useState<ComputerDifficulties>(opponent.difficulty ?? {});
  const [speed, setSpeed] = useState<ComputerSpeed>(opponent.speed ?? 'normal');
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  async function apply() {
    setSaving(true);
    setError('');
    try {
      await onApply({ ...opponent, difficulty, ...(opponent.side === 'both' && { speed }) });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Impossibile salvare le impostazioni AI.');
    } finally { setSaving(false); }
  }
  return <GameInfoDialog title="Impostazioni AI" onClose={() => { if (!saving) onClose(); }}>
    <DifficultySelects side={opponent.side} value={difficulty} onChange={setDifficulty} disabled={saving}/>
    {opponent.side === 'both' && <ComputerSpeedSelect id="game-computer-speed" value={speed} onChange={setSpeed} disabled={saving}/>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    <div className="button-row"><button type="button" className="button primary" disabled={busy || saving} onClick={() => void apply()}>{saving ? 'Salvataggio…' : 'Applica'}</button></div>
  </GameInfoDialog>;
}
