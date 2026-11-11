import type { Kind } from '../engine/game';

export type Language = 'it' | 'en';

type MageTerms = { name: string; short: string; ability: string };

export const mageGlossary = {
  it: {
    aeromancer: { name: 'Aeromante', short: 'AER', ability: 'Vento impetuoso' },
    electromancer: { name: 'Elettromante', short: 'ELE', ability: 'Scarica a catena' },
    enchanter: { name: 'Incantatore', short: 'INC', ability: 'Tocco psichico' },
    geomancer: { name: 'Geomante', short: 'GEO', ability: 'Presa della terra' },
    illusionist: { name: 'Illusionista', short: 'ILL', ability: 'Copia illusoria' },
    pyromancer: { name: 'Piromante', short: 'PIR', ability: 'Palla di fuoco' },
    spellsword: { name: 'Lamarcana', short: 'LAM', ability: 'Lama arcana' },
    teleporter: { name: 'Teletrasportatore', short: 'TEL', ability: 'Teletrasporto' },
  },
  en: {
    aeromancer: { name: 'Aeromancer', short: 'AER', ability: 'Gale' },
    electromancer: { name: 'Electromancer', short: 'ELE', ability: 'Chain Lightning' },
    enchanter: { name: 'Enchanter', short: 'ENC', ability: 'Psychic Touch' },
    geomancer: { name: 'Geomancer', short: 'GEO', ability: 'Earth Grasp' },
    illusionist: { name: 'Illusionist', short: 'ILL', ability: 'Illusory Copy' },
    pyromancer: { name: 'Pyromancer', short: 'PYR', ability: 'Fireball' },
    spellsword: { name: 'Spellsword', short: 'SPL', ability: 'Arcane Blade' },
    teleporter: { name: 'Teleporter', short: 'TEL', ability: 'Teleport' },
  },
} satisfies Record<Language, Record<Kind, MageTerms>>;

export const conditionGlossary = {
  it: { restrained: 'Immobilizzato', charmed: 'Incantato', activated: 'Già attivato' },
  en: { restrained: 'Restrained', charmed: 'Charmed', activated: 'Already activated' },
} satisfies Record<Language, Record<'restrained' | 'charmed' | 'activated', string>>;
