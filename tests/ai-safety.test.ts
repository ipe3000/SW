import { it, expect } from 'vitest';
import { activate, newMatch, wizard } from '../src/engine/game';
import { chooseMove } from '../src/ai/search';
import { immediateWin } from '../src/ai/tactics';
import { activationSeeds } from '../src/ai/candidates';
import { applyComputerCommand } from '../src/ai/types';
import { decisionPosition } from '../src/ai/position';
import { syntheticSafetyPosition } from './ai-positions';

it('il passo extra sottrae un alleato alla combinazione fuoco e spada su una posizione sintetica',()=>{
  const input=syntheticSafetyPosition();
  const next=applyComputerCommand(input,chooseMove(input,'hard').command);
  const fire={wizardId:'blue:pyromancer',before:[{x:5,y:2},{x:5,y:3}],spell:{kind:'fireball' as const,center:{x:5,y:5}},after:[{x:6,y:3}]};
  let after;
  try {after=activate(next,fire);} catch {return;}
  expect([...activationSeeds(after,'blue:spellsword')].some(c=>!c.game.wizards.some(w=>w.id==='red:teleporter'))).toBe(false);
},15000);

it('una scansione interrotta non certifica la sicurezza',()=>{
  const game=syntheticSafetyPosition();game.phase=0;game.activated=[];
  game.wizards=game.wizards.filter(w=>w.side==='red'||['spellsword','teleporter','geomancer','enchanter'].includes(w.kind));
  wizard(game,'blue:spellsword')!.hp=1;
  expect(immediateWin(game,performance.now()-1).complete).toBe(false);
});

it('la scansione convalida una vittoria immediata nel motore',()=>{
  const game=newMatch().game;game.walls=[];game.turn=2;
  game.wizards=game.wizards.filter(w=>w.side==='red'||['spellsword','aeromancer','enchanter','teleporter'].includes(w.kind));
  wizard(game,'red:spellsword')!.pos={x:4,y:4};
  wizard(game,'blue:spellsword')!.pos={x:5,y:4};wizard(game,'blue:spellsword')!.hp=2;
  const win=immediateWin(game,performance.now()+2000);
  expect(win.command).toBeDefined();expect(applyComputerCommand(game,win.command!).result?.winner).toBe('red');
});

it('non scambia una scarica suicida per una vittoria',()=>{
  const game=newMatch().game;game.walls=[];game.turn=2;
  game.wizards=game.wizards.filter(w=>['electromancer','illusionist','geomancer','teleporter'].includes(w.kind));
  game.wizards.forEach((w,i)=>{w.pos={x:i,y:w.side==='red'?8:0};});
  const actor=wizard(game,'red:electromancer')!,ally=wizard(game,'red:illusionist')!,enemy=wizard(game,'blue:illusionist')!;
  actor.pos={x:4,y:4};ally.pos={x:5,y:4};ally.hp=1;enemy.pos={x:6,y:4};enemy.hp=1;
  game.activated=game.wizards.filter(w=>w.side==='red'&&w.id!==actor.id).map(w=>w.id);
  expect(immediateWin(game,performance.now()+2000).command).toBeUndefined();
});

it('il piano dipende dalla posizione e non dalla cronologia grafica',()=>{
  const game=syntheticSafetyPosition(),key=decisionPosition(game);
  game.log.push('informazione');expect(decisionPosition(game)).toBe(key);
  game.wizards[0].hp--;expect(decisionPosition(game)).not.toBe(key);
});

it.each(['illusionist','pyromancer'] as const)('trova la vittoria di %s, anche con due eliminazioni',kind=>{
  const game=newMatch().game;game.walls=[];game.turn=2;
  const own=['teleporter','geomancer','enchanter',kind];
  const enemy=kind==='pyromancer'?['spellsword','illusionist','teleporter','geomancer','enchanter']:['spellsword','teleporter','geomancer','enchanter'];
  game.wizards=game.wizards.filter(w=>(w.side==='red'?own:enemy).includes(w.kind));
  game.wizards.forEach((w,i)=>{w.pos={x:i%8,y:w.side==='red'?9:0};});
  wizard(game,`red:${kind}`)!.pos={x:4,y:4};
  const first=wizard(game,'blue:spellsword')!;first.pos={x:6,y:4};first.hp=1;
  if(kind==='pyromancer'){const second=wizard(game,'blue:illusionist')!;second.pos={x:6,y:5};second.hp=1;}
  game.activated=game.wizards.filter(w=>w.side==='red'&&w.kind!==kind).map(w=>w.id);
  const win=immediateWin(game,performance.now()+2000);
  expect(win.command).toBeDefined();expect(applyComputerCommand(game,win.command!).result?.winner).toBe('red');
});
