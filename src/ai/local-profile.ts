import type { ComputerDifficulty, Game, OptionalRules } from '../engine/game';
import { ai2HardProfile, type HardProfile } from './profile';

const key = 'strategic-wizardry-local-hard-profile-v1';
export const profileWeightFloor = .65;
export const profileWeightCeiling = 1.35;
export type LocalHardProfile = OptionalRules & {
  id: string;
  source: string;
  field: { top: string; bottom: string };
  values: HardProfile;
};

function valid(profile: LocalHardProfile | null): profile is LocalHardProfile {
  return Boolean(typeof profile?.id === 'string' && profile.id && typeof profile.source === 'string' && profile.source &&
    /^[C-H]$/.test(profile.field?.top) && /^[C-H]$/.test(profile.field?.bottom) &&
    (profile.safeLightning === undefined || typeof profile.safeLightning === 'boolean') &&
    (profile.shorterSpellswordMove === undefined || typeof profile.shorterSpellswordMove === 'boolean') &&
    (Object.keys(ai2HardProfile) as (keyof HardProfile)[]).every(weight => {
      const value = profile.values?.[weight];
      return Number.isFinite(value) && value >= profileWeightFloor && value <= profileWeightCeiling;
    }));
}

export function readLocalHardProfile(): LocalHardProfile | undefined {
  try {
    const profile = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (valid(profile)) return profile;
  } catch { /* Local storage can be unavailable or contain an older profile. */ }
}

export function saveLocalHardProfile(profile?: LocalHardProfile) {
  if (!profile) localStorage.removeItem(key);
  else {
    if (!valid(profile)) throw new Error('Profilo Difficile non valido.');
    const { id, source, field, values, safeLightning, shorterSpellswordMove } = profile;
    localStorage.setItem(key, JSON.stringify({ id, source, field, values, safeLightning, shorterSpellswordMove }));
  }
}

export function localHardWeights(game: Game, difficulty: ComputerDifficulty): HardProfile | undefined {
  if (difficulty !== 'hard' || game.options.hp !== 4 || game.options.walls !== 'standard' ||
      game.options.placement !== 'standard' || game.walls.length !== 2) return;
  const profile = readLocalHardProfile();
  if (profile && Boolean(profile.safeLightning) === Boolean(game.options.safeLightning) &&
      Boolean(profile.shorterSpellswordMove) === Boolean(game.options.shorterSpellswordMove) &&
      game.walls.some(wall => wall.y === 4 && wall.x === profile.field.top.charCodeAt(0) - 65) &&
      game.walls.some(wall => wall.y === 5 && wall.x === profile.field.bottom.charCodeAt(0) - 65)) return profile.values;
}
