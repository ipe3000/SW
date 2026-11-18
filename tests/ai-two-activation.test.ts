import { expect,it } from 'vitest';
import fixtures from './fixtures/ailab-four-defeats.json';
import { twoActivationWin } from '../src/ai/tactics';
import { applyComputerCommand } from '../src/ai/types';
import type { Game } from '../src/engine/game';
import { newMatch } from '../src/engine/game';
import { chooseMove } from '../src/ai/search';
import { decisionPosition } from '../src/ai/position';
import { activationSeeds } from '../src/ai/candidates';

it('returns unknown when interrupted and clears impossible fresh 4 HP openings',()=>{
 const game=newMatch().game;game.turn=2;
 expect(twoActivationWin(game,performance.now()-1)).toMatchObject({complete:false});
 const clear=twoActivationWin(game,performance.now()+1000);expect(clear.complete).toBe(true);expect(clear.line).toBeUndefined();
});
it.each(fixtures)('detects and replays the winning response in $id', fixture=>{
 const before=fixture.position as Game;
 const game=applyComputerCommand(before,fixture.original as any);
 const start=performance.now(),scan=twoActivationWin(game,start+1000,4000);
 console.info(fixture.id,Math.round(performance.now()-start),scan.checked,scan.complete,scan.line);
 expect(scan.line).toBeDefined();
 let final=game;for(const command of scan.line!)final=applyComputerCommand(final,command);
 expect(final.result?.winner).toBe(game.active);expect(scan.line!.length).toBeLessThanOrEqual(2);
},5000);

it.each([0,3])('Difficile interrupts the recorded defeat from turn start in scenario %i',index=>{
 const fixture=fixtures[index];
 let game=structuredClone(fixture.turnStart) as Game;
 const side=game.active,start=performance.now();
 const decisions=[];
 let hint:ReturnType<typeof chooseMove>['continuation'];
 for(let i=0;i<3 && game.active===side && !game.result;i++) {
   const decision=chooseMove(game,'hard',hint?.find(step=>step.position===decisionPosition(game))?.command);
   decisions.push(decision); hint=decision.continuation; game=applyComputerCommand(game,decision.command);
 }
 console.info('defence',fixture.id,Math.round(performance.now()-start),decisions.map(d=>d.diagnostics));
 let blocked=false;
 try{for(const command of fixture.enemyFinish)game=applyComputerCommand(game,command as any);}catch{blocked=true;}
 expect(blocked || game.result?.winner===side || !game.result).toBe(true);
},20000);

it.each(fixtures)('all final extra-step alternatives are losing within two activations in $id',fixture=>{
 const game=fixture.position as Game;
 const commands=[...activationSeeds(game)].map(c=>({kind:'activate' as const,activation:c.activation}));
 for(const command of [...commands,{kind:'skip' as const}]) {
   let next=applyComputerCommand(game,command);
   const scan=twoActivationWin(next,performance.now()+1000,4000);
   expect(scan.line).toBeDefined();
   for(const reply of scan.line!)next=applyComputerCommand(next,reply);
   expect(next.result?.winner).not.toBe(game.active);
 }
},10000);
