import type { Effect, Game, Kind, Side } from './game';

export type MageId = `${Side}:${Kind}`;
export type RecapImpact =
  | { kind: 'damage'; target: MageId; hp: number }
  | { kind: 'removed' | 'restrain' | 'move'; target: MageId };

export type RecapEntry = { turn: number; logLength: number } & (
  | { kind: 'skip'; side: Side }
  | { kind: 'turn-end'; charmed: MageId[] }
  | { kind: 'activation'; mage: MageId; extra: boolean; ability: boolean; impacts: RecapImpact[] }
);

export function tallyImpacts(effects: Effect[]): RecapImpact[] {
  return effects.flatMap<RecapImpact>(effect => {
    if (!effect.wizardId || effect.kind === 'copy') return [];
    const target = effect.wizardId as MageId;
    return effect.kind === 'damage'
      ? [{ kind: 'damage', target, hp: Math.min(effect.amount!, effect.fromHp!) }]
      : [{ kind: effect.kind, target }];
  });
}

const sideOf = (mage: MageId): Side => mage.startsWith('red:') ? 'red' : 'blue';
const split = () => ({ ally: 0, enemy: 0 });
const control = () => ({ restraints: 0, charms: 0, wind: split(), teleport: split() });
const guildStats = () => ({ enemy: 0, friendly: 0, applied: control() });
const mageStats = () => ({
  full: 0, extra: 0, abilities: 0, usedTurns: 0, lastTurn: -1,
  enemy: 0, friendly: 0, alliedLosses: 0, lost: split(), applied: control(), received: control(),
});

export function summarizeDuel(entries: readonly RecapEntry[]) {
  const guilds = { red: guildStats(), blue: guildStats() };
  const mages: Partial<Record<MageId, ReturnType<typeof mageStats>>> = {};
  const eliminated: Partial<Record<MageId, number>> = {};
  const damageByTurn = new Map<number, Record<Side, number>>();
  const charmTurns = new Set<number>();

  for (const entry of entries) {
    if (entry.kind === 'skip') continue;
    if (entry.kind === 'turn-end') {
      charmTurns.add(entry.turn);
      for (const id of entry.charmed) {
        const opponent = sideOf(id) === 'red' ? 'blue' : 'red';
        const enchanter = mages[`${opponent}:enchanter`] ??= mageStats();
        const mage = mages[id] ??= mageStats();
        enchanter.applied.charms++;
        guilds[opponent].applied.charms++;
        mage.received.charms++;
      }
      continue;
    }
    const side = sideOf(entry.mage), guild = guilds[side], turn = entry.turn + 1;
    const mage = mages[entry.mage] ??= mageStats();
    mage[entry.extra ? 'extra' : 'full']++;
    if (entry.ability) mage.abilities++;
    if (mage.lastTurn !== turn) {
      mage.usedTurns++;
      mage.lastTurn = turn;
    }
    for (const impact of entry.impacts) {
      const targetSide = sideOf(impact.target);
      const relation = targetSide === side ? 'ally' : 'enemy';
      const target = mages[impact.target] ??= mageStats();
      switch (impact.kind) {
        case 'damage': {
          const metric = relation === 'ally' ? 'friendly' : 'enemy';
          mage[metric] += impact.hp;
          guild[metric] += impact.hp;
          target.lost[relation] += impact.hp;
          const damage = damageByTurn.get(turn) ?? { red: 0, blue: 0 };
          damage[targetSide] += impact.hp;
          damageByTurn.set(turn, damage);
          break;
        }
        case 'removed':
          if (relation === 'ally') mage.alliedLosses++;
          eliminated[impact.target] = turn;
          break;
        case 'restrain':
          mage.applied.restraints++;
          guild.applied.restraints++;
          target.received.restraints++;
          break;
        case 'move': {
          const spell = entry.mage.endsWith(':teleporter') ? 'teleport' : 'wind';
          mage.applied[spell][relation]++;
          guild.applied[spell][relation]++;
          target.received[spell][relation]++;
          break;
        }
      }
    }
  }

  return { guilds, mages, eliminated, charmTurns, damageByTurn };
}

// Red acts on turn 1 and the guilds alternate. A mage eliminated during its
// own turn was still available at that turn's start.
export function availableTurns(game: Game, id: MageId, eliminatedOn?: number) {
  if (eliminatedOn === undefined && !game.wizards.some(mage => mage.id === id)) return 0;
  const lastTurn = eliminatedOn ?? game.turn + 1;
  return sideOf(id) === 'red' ? Math.ceil(lastTurn / 2) : Math.floor(lastTurn / 2);
}
