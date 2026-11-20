import { activate, at, charmed, lightningTargets, previewActivation, speed, targetPoints, wizard, type Game, type Spell } from '../../../src/engine/game';
import { distance } from '../../../src/engine/geometry';
import { activationSeeds, movementPaths, spellCandidates, type Candidate } from './candidates';
import { afterSpellCandidates } from './didactic';
import { applyComputerCommand, type ComputerCommand } from './types';

export type TurnThreat = { line?: ComputerCommand[]; complete: boolean; checked: number };
/** At most two full activations. Only a replayed terminal line proves a threat.
 * clear is restricted to this horizon; deadlines and node caps always return unknown. */
export function twoActivationWin(game: Game, deadline: number, maxPositions = 800): TurnThreat {
  if (performance.now() >= deadline) return { complete:false, checked:0 };
  if (game.result || game.pending || game.stage !== 'playing' || game.phase >= 2) return {complete:true,checked:0};
  const direct=immediateWin(game,deadline);
  if(direct.command) return {line:[direct.command],complete:true,checked:direct.checked};
  if(!direct.complete) return direct;
  if(game.phase!==0 || game.turn===0) return direct;
  // A single target can lose at most 3 HP: one sword (2) and another mage (1).
  const enemies=game.wizards.filter(w=>w.side!==game.active);
  if(enemies.filter(w=>w.hp<=3).length < enemies.length-3) return direct;
  let checked=direct.checked;
  const seen=new Set<string>();
  const generators=game.wizards.filter(w=>w.side===game.active && !game.activated.includes(w.id))
    .map(w=>activationSeeds(game,w.id,true));
  const pending: Candidate[]=[];
  const followUps: Candidate[]=[];
  let generationComplete=false;
  // Fairly collect a bounded batch before ordering preparations and damage together.
  while(generators.length && checked+pending.length<maxPositions && performance.now()<deadline) {
    for(let i=generators.length-1;i>=0;i--) {
      if(performance.now()>=deadline)break;
      const next=generators[i].next();
      if(next.done) generators.splice(i,1); else pending.push(next.value);
    }
    if(pending.length>=120)break;
  }
  generationComplete=generators.length===0;
  const rank=(candidate:Candidate)=> {
    const g=candidate.game;
    const damage=game.wizards.reduce((n,w)=>n+(w.side!==game.active? w.hp-(wizard(g,w.id)?.hp??0):0),0);
    const proximity=Math.min(30,...g.wizards.filter(w=>w.side===game.active && !g.activated.includes(w.id) && w.kind!=='teleporter').flatMap(w=>g.wizards.filter(e=>e.side!==game.active && e.hp<=2).map(e=>distance(w.pos!,e.pos!))));
    return damage*12-proximity;
  };
  const inspect=(candidate:Candidate): TurnThreat | undefined=>{
    const command:ComputerCommand={kind:'activate',activation:candidate.activation};
    const next=applyComputerCommand(game,command),key=JSON.stringify([next.active,next.phase,next.activated,next.wizards,next.copies]);
    if(seen.has(key))return;
    seen.add(key);checked++;
    if(next.result?.winner===game.active)return {line:[command],complete:true,checked};
    if(next.result || next.active!==game.active)return;
    const scan=immediateWin(next,deadline);checked+=scan.checked;
    if(scan.command) {
      const final=applyComputerCommand(next,scan.command);
      if(final.result?.winner===game.active)return {line:[command,scan.command],complete:true,checked};
    }
    if(!scan.complete)return {complete:false,checked};
  };
  while(pending.length || generators.length) {
    pending.sort((a,b)=>rank(b)-rank(a));
    for(const candidate of pending.splice(0)) {
      if(performance.now()>=deadline || checked>=maxPositions)return {complete:false,checked};
      const found=inspect(candidate);if(found)return found;
      // Moving after the first ability can unblock a line or release charm.
      if(candidate.activation.spell && !candidate.game.pending) followUps.push(candidate);
    }
    for(let i=generators.length-1;i>=0;i--) {
      if(performance.now()>=deadline || checked>=maxPositions)return {complete:false,checked};
      const next=generators[i].next();if(next.done)generators.splice(i,1);else pending.push(next.value);
    }
    generationComplete=generators.length===0;
  }
  for(const candidate of followUps) for(const after of afterSpellCandidates(game,[candidate])) {
    if(performance.now()>=deadline || checked>=maxPositions)return {complete:false,checked};
    const found=inspect(after);if(found)return found;
  }
  return {complete:generationComplete,checked};
}

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
