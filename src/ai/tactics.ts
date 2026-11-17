import { activate, at, charmed, lightningTargets, previewActivation, speed, targetPoints, wizard, type Game, type Spell } from '../engine/game';
import { distance } from '../engine/geometry';
import { movementPaths, spellCandidates } from './candidates';
import type { ComputerCommand } from './types';

/** Enumerate damage that can end this game, ignoring harmless spell permutations and movement after a win.
 * Every result is validated by the shared rules. An interrupted scan never means the position is safe. */
export function immediateWin(game: Game, deadline: number): { command?: ComputerCommand; complete: boolean; checked: number } {
  if (game.stage !== 'playing' || game.pending || game.phase >= 2) return { complete: true, checked: 0 };
  const needed = game.wizards.filter(w => w.side !== game.active).length - 3;
  const enemies = game.wizards.filter(w=>w.side!==game.active);
  let checked = 0;
  for (const initial of game.wizards) {
    if (initial.side !== game.active || !initial.pos || game.activated.includes(initial.id) || charmed(game, initial) || initial.kind === 'teleporter') continue;
    const area=initial.kind==='electromancer'||initial.kind==='pyromancer';
    if (area ? enemies.filter(w=>w.hp===1).length<needed : needed!==1 || !enemies.some(w=>w.hp<=(initial.kind==='spellsword'?2:1))) continue;
    for (const path of movementPaths(game, initial.pos, speed(game, initial), initial.side, initial.id)) {
      if (performance.now() >= deadline) return { complete: false, checked };
      const activation = { wizardId: initial.id, before: path.steps, after: [] };
      const atCast = previewActivation(game, activation).game, caster = wizard(atCast, initial.id)!;
      const enemies = atCast.wizards.filter(w => w.side !== game.active && w.pos);
      const trySpell = (spell: Spell): ComputerCommand | undefined => {
        checked++;
        const action = {...activation,spell};
        try { if (activate(game,action).pending?.winner === game.active) return {kind:'activate',activation:action}; }
        catch { /* A terminal spell cannot end on a friendly occupied square. */ }
        return undefined;
      };
      const spells: Spell[] = [];
      if (caster.kind === 'electromancer') {
        if (lightningTargets(atCast, caster).filter(w => w.side !== caster.side && w.hp === 1).length >= needed) spells.push({kind:'lightning'});
      } else if (caster.kind === 'pyromancer') {
        for (const center of targetPoints(atCast, caster)) if (enemies.filter(w => w.hp === 1 && distance(w.pos!, center) <= 1).length >= needed) spells.push({kind:'fireball',center});
      } else if (needed === 1 && caster.kind === 'illusionist') {
        for (const spell of spellCandidates(atCast, caster)) {
          if (performance.now() >= deadline) return { complete: false, checked };
          if (spell.kind === 'illusion' && spell.targetId && wizard(atCast, spell.targetId)?.hp === 1) {
            const command=trySpell(spell);
            if(command) return {command,complete:true,checked};
          }
        }
      } else if (needed === 1) {
        for (const point of targetPoints(atCast, caster)) {
          const target = at(atCast,point)!;
          if (target.side === caster.side || target.hp > (caster.kind === 'spellsword' ? 2 : 1)) continue;
          if (caster.kind === 'aeromancer') spells.push({kind:'wind',targetId:target.id,path:[]});
          else if (caster.kind === 'spellsword' || caster.kind === 'geomancer' || caster.kind === 'enchanter')
            spells.push({kind:caster.kind === 'spellsword' ? 'sword' : caster.kind === 'geomancer' ? 'earth' : 'touch',targetId:target.id});
        }
      }
      for (const spell of spells) {
        if (performance.now() >= deadline) return { complete: false, checked };
        const command=trySpell(spell);
        if(command) return {command,complete:true,checked};
      }
    }
  }
  return { complete: true, checked };
}
