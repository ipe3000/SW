import { wizard, type Game } from '../engine/game';
import type { ComputerCommand } from './types';

export type LightningTuning = { mode: 'opportunity' | 'impact'; bonus: number };

export function lightningImpact(before: Game, after: Game) {
  let enemyDamage = 0, allyDamage = 0, enemyKills = 0, allyKills = 0;
  for (const mage of before.wizards) {
    const remaining = wizard(after, mage.id);
    const damage = mage.hp - (remaining?.hp ?? 0);
    if (damage <= 0) continue;
    if (mage.side === before.active) {
      allyDamage += damage;
      if (!remaining) allyKills++;
    } else {
      enemyDamage += damage;
      if (!remaining) enemyKills++;
    }
  }
  return { enemyDamage, allyDamage, enemyKills, allyKills };
}

/** Score only the effects of the legal cast under consideration. Equal trades earn no bonus. */
export function lightningReward(before: Game, command: ComputerCommand, after: Game, bonus: number): number {
  if (!bonus || command.kind !== 'activate' || command.activation.spell?.kind !== 'lightning') return 0;
  const { enemyDamage, allyDamage, enemyKills, allyKills } = lightningImpact(before, after);
  return (12 * (enemyDamage - allyDamage) + 85 * (enemyKills - allyKills)) * bonus / 100;
}

export function withLightningReward(score: number, reward: number | undefined): number {
  // Preserve exact win/loss scores returned by the position evaluator.
  return reward && Math.abs(score) < 999999 ? score + reward : score;
}
