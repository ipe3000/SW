import { useLanguage } from '../i18n/language';
export type GameMode = 'local' | 'computer' | 'watch' | 'online';
export type LocalMode = Exclude<GameMode, 'online'>;

export function GameModes({ value, onChange }: { value: GameMode; onChange: (mode: GameMode) => void }) {
  const { language } = useLanguage();
  return <fieldset className="mode-choice"><legend>{(language === 'en' ? "Mode" : "Modalità")}</legend>{([
    ['local', (language === 'en' ? "Two players" : "Due giocatori")],
    ['computer', (language === 'en' ? "Against the computer" : "Contro il computer")],
    ['online', (language === 'en' ? "Online with a friend" : "Online con un amico")],
    ['watch', 'Computer vs Computer'],
  ] as const).map(([mode, label]) => <label key={mode}><input type="radio" name="opponent" value={mode} checked={value === mode} onChange={() => onChange(mode)}/>{label}</label>)}</fieldset>;
}
