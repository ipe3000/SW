import type { OptionalRules } from '../engine/game';

const labels = {
  it: {
    safeLightning: 'Elettromante senza fuoco amico',
    shorterSpellswordMove: 'Lamarcana: movimento di 3 caselle',
  },
  en: {
    safeLightning: 'Electromancer with no friendly fire',
    shorterSpellswordMove: 'Spellsword: 3-square movement',
  },
};
const rules = ['safeLightning', 'shorterSpellswordMove'] as const;

export function OptionalRuleControls({ value, onChange, language = 'it', className }: {
  value: OptionalRules;
  onChange: (rule: keyof OptionalRules, enabled: boolean) => void;
  language?: keyof typeof labels;
  className: string;
}) {
  return rules.map(rule => <label key={rule} className={className}>
    <input type="checkbox" checked={value[rule] ?? false} onChange={event => onChange(rule, event.target.checked)}/>
    {labels[language][rule]}
  </label>);
}
