import {expect,it} from 'vitest';
import {casesFor,defaults,hardBudgetComparison,engineStatistics,initialGame,markdown,type Campaign,type Result} from '../src/ailab/model';
it('swaps versions even at equal difficulty on identical fields',()=>{
const cases=casesFor({...defaults,mode:'pair',a:'normal',b:'normal',engineA:'1',engineB:'2',fields:1});
expect(cases).toHaveLength(2);
expect(cases.map(c=>[c.redEngine,c.blueEngine])).toEqual([['1','2'],['2','1']]);
expect(cases[0].seed).toBe(cases[1].seed);
});

it('compares the unchanged tactical engine with extended Hard on both sides of every field',()=>{
 const cases=casesFor(hardBudgetComparison);
 expect(cases).toHaveLength(6);
 for(let i=0;i<cases.length;i+=2){
  expect(cases[i].red).toBe('hard');expect(cases[i].blue).toBe('hard');
  expect([cases[i].redEngine,cases[i].blueEngine]).toEqual(['2','3']);
  expect([cases[i+1].redEngine,cases[i+1].blueEngine]).toEqual(['3','2']);
  expect(cases[i].fieldKey).toBe(cases[i+1].fieldKey);
 }
});

it('attributes timing and results to the engine taking each decision, including engine 3',()=>{
 const test=casesFor({...hardBudgetComparison,fields:1})[0],before=initialGame(test);
 const row:Result={test,outcome:'blue',steps:[
  {before,command:{kind:'skip'},milliseconds:2000,evaluated:1},
  {before:{...before,active:'blue'},command:{kind:'skip'},milliseconds:5000,evaluated:1},
  {before:{...before,active:'blue'},command:{kind:'skip'},milliseconds:4000,evaluated:1}
 ],final:before,findings:[],audits:{completed:0,interrupted:0},elapsed:11000};
 expect(engineStatistics([row])).toEqual([
  {engine:'2',wins:0,losses:1,incomplete:0,decisions:1,averageMs:2000,maxMs:2000},
  {engine:'3',wins:1,losses:0,incomplete:0,decisions:2,averageMs:4500,maxMs:5000}
 ]);
 const campaign:Campaign={format:'strategic-wizardry-ailab',schema:1,id:'timing',created:'2026-11-20',build:'test',userAgent:'test',config:hardBudgetComparison,cases:[test],results:[row]};
 expect(markdown(campaign)).toContain('AI #3 · Difficile, analisi estesa | 1 | 0 | 0 | 2 | 4500 / 5000');
});
