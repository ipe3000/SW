import { describe, expect, it } from 'vitest';
import { newMatch, type Game } from '../src/engine/game';
import { quietOpening, openingTimeScale } from '../src/ai/opening-pace';
import { chooseMove } from '../src/ai/search';
import {applyComputerCommand} from '../src/ai/types';
import { planningBudgets } from '../src/ai/planner';

describe('Difficile: budget moderato nelle aperture tranquille',()=>{
 it('shortens only Hard and does not depend on presentation history',()=>{
  const game=newMatch().game;
  expect(quietOpening(game)).toBe(true);
  expect(openingTimeScale(game,'hard')).toBe(.85);
  expect(openingTimeScale(game,'normal')).toBe(1);expect(openingTimeScale(game,'easy')).toBe(1);
  game.log.push('Danno: testo informativo');expect(quietOpening(game)).toBe(true);
 });
 it('restores full budget at contact, damage, casualties, control or deployment',()=>{
  const fresh=newMatch().game;
  const variants:Game[]=[];
  const contact=structuredClone(fresh); contact.wizards.find(w=>w.side==='red')!.pos={x:1,y:4};variants.push(contact);
  const hurt=structuredClone(fresh);hurt.wizards[0].hp--;variants.push(hurt);
  const casualty=structuredClone(fresh);casualty.wizards.pop();variants.push(casualty);
  const control=structuredClone(fresh);control.wizards[0].restrainedUntil=1;variants.push(control);
  variants.push({...fresh,stage:'deployment'});
  for(const game of variants){expect(quietOpening(game)).toBe(false);expect(openingTimeScale(game,'hard')).toBe(1);}
 });
 it('returns a legal opening decision with an observable reduced budget',()=>{
  const game=newMatch().game,original=structuredClone(game),decision=chooseMove(game,'hard');
  expect(game).toEqual(original);expect(decision.diagnostics?.openingTimeScale).toBe(.85);
  expect(decision.diagnostics?.budgetMilliseconds).toBe(planningBudgets.hard.milliseconds*.85);
  expect(decision.command.kind).toBe('activate');
  expect(applyComputerCommand(game,decision.command)).not.toEqual(game);
 },10000);
});
