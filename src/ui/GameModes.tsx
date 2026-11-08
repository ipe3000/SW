export type GameMode = 'local' | 'computer' | 'watch' | 'online';
export type LocalMode = Exclude<GameMode, 'online'>;

export function GameModes({ value, onChange }: { value: GameMode; onChange: (mode: GameMode) => void }) {
  return <fieldset className="mode-choice"><legend>Modalità</legend>{([
    ['local', 'Due giocatori'],
    ['computer', 'Contro il computer'],
    ['online', 'Online con un amico'],
    ['watch', 'Computer vs Computer'],
  ] as const).map(([mode, label]) => <label key={mode}><input type="radio" name="opponent" value={mode} checked={value === mode} onChange={() => onChange(mode)}/>{label}</label>)}</fieldset>;
}
