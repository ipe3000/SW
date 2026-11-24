import type { OptionalRules } from '../engine/game';

const labels = {
  it: {
    safeLightning: 'Elettromante senza fuoco amico',
    shorterSpellswordMove: 'Lamarcana: movimento di 3 caselle',
    fasterEnchanter: 'Incantatore: movimento di 5 caselle',
  },
  en: {
    safeLightning: 'Electromancer with no friendly fire',
    shorterSpellswordMove: 'Spellsword: 3-square movement',
    fasterEnchanter: 'Enchanter: 5-square movement',
  },
};
const rules = ['safeLightning', 'shorterSpellswordMove'] as const;

export function OptionalRuleControls({ value, onChange, language = 'it', className, includeFasterEnchanter = false }: {
  value: OptionalRules;
  onChange: (rule: keyof OptionalRules, enabled: boolean) => void;
  language?: keyof typeof labels;
  className: string;
  includeFasterEnchanter?: boolean;
}) {
  const visibleRules = includeFasterEnchanter ? [...rules, 'fasterEnchanter'] as const : rules;
  return visibleRules.map(rule => <label key={rule} className={className}>
    <input type="checkbox" checked={value[rule] ?? false} onChange={event => onChange(rule, event.target.checked)}/>
    {labels[language][rule]}
  </label>);
}
