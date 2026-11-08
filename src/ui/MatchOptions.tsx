import type { Options } from '../engine/game';

export function MatchOptions({ value, onChange }: { value: Options; onChange: (options: Options) => void }) {
  const standard = value.hp === 4 && value.walls === 'standard' && value.placement === 'standard';
  return <details className="setup-options"><summary>Opzioni di partita<span>{value.hp} PV · {standard ? 'Regole standard' : 'Personalizzate'}</span></summary>
    <label>Punti vita iniziali<select value={value.hp} onChange={e => onChange({ ...value, hp: Number(e.target.value) as Options['hp'] })}><option value={3}>3 PV · rapida</option><option value={4}>4 PV · standard</option><option value={5}>5 PV · resistente</option></select></label>
    <label>Muri di forza<select value={value.walls} onChange={e => onChange({ ...value, walls: e.target.value as Options['walls'] })}><option value="standard">Standard · due muri, due dadi</option><option value="varied">Alternativa · quattro settori</option></select></label>
    <label>Schieramento<select value={value.placement} onChange={e => onChange({ ...value, placement: e.target.value as Options['placement'] })}><option value="standard">Standard</option><option value="custom">Personalizzato · 4 / 6 / 2 / 2 / 2</option></select></label>
  </details>;
}
