import { expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chooseMove as reference } from './ai-versions/tactical-reinforcements-20261120/search';
import { chooseMove as extended } from './ai-versions/extended-hard-20261120/search';
import { applyComputerCommand } from '../src/ai/types';
import { decisionPosition } from '../src/ai/position';
import type { Campaign } from '../src/ailab/model';

it('measures both budgets sequentially on the same archived positions, stratified by phase',()=>{
 const path=process.env.SW_AI_ARCHIVE;
 if(!path)throw new Error('Set SW_AI_ARCHIVE to an AILab JSON archive.');
 const archive=JSON.parse(readFileSync(path,'utf8')) as Campaign;
 const positions=archive.results.flatMap(row=>row.steps.filter(step=>row.test[step.before.active]==='hard' && (step.before.active==='red'?row.test.redEngine:row.test.blueEngine)==='2').map(step=>({case:row.test.id,step})));
 const sample=[0,1,2].flatMap(phase=>{
  const rows=positions.filter(row=>row.step.before.phase===phase);
  return Array.from({length:Math.min(6,rows.length)},(_,i)=>rows[Math.floor((i+.5)*rows.length/Math.min(6,rows.length))]);
 });
 expect(sample).toHaveLength(18);
 const records=[];
 for(const [index,{case:caseId,step}] of sample.entries()){
  const decisions=[];
  // Alternate measurement order to distribute warm-up and machine-load effects.
  for(const [engine,choose] of index%2 ? [['3',extended],['2',reference]] as const : [['2',reference],['3',extended]] as const){
   const before=structuredClone(step.before),start=performance.now(),decision=choose(before,'hard'),milliseconds=performance.now()-start;
   expect(before).toEqual(step.before);
   expect(decisionPosition(applyComputerCommand(before,decision.command))).not.toBe(decisionPosition(before));
   decisions.push({engine,milliseconds,evaluated:decision.evaluated,diagnostics:decision.diagnostics,command:decision.command});
  }
  records.push({case:caseId,turn:step.before.turn,phase:step.before.phase,decisions});
 }
 const summary=['2','3'].map(engine=>{
  const rows=records.flatMap(row=>row.decisions.filter(d=>d.engine===engine)),times=rows.map(r=>r.milliseconds).sort((a,b)=>a-b);
  return {engine,decisions:rows.length,averageMs:Math.round(times.reduce((s,n)=>s+n,0)/times.length),medianMs:Math.round(times[Math.floor(times.length/2)]),maxMs:Math.round(times.at(-1)!),averageNodes:Math.round(rows.reduce((s,r)=>s+r.evaluated,0)/rows.length),averageRounds:rows.reduce((s,r)=>s+(r.diagnostics?.completedRounds??0),0)/rows.length,nodeExhausted:rows.filter(r=>r.diagnostics?.nodesExhausted).length};
 });
 const result={archiveId:archive.id,description:'18 archived positions, six per phase, no continuation hints; timing calibration, not a strength match',summary,changedCommands:records.filter(row=>JSON.stringify(row.decisions[0].command)!==JSON.stringify(row.decisions[1].command)).length,records};
 mkdirSync('output/hard-budget',{recursive:true});writeFileSync('output/hard-budget/calibration.json',JSON.stringify(result,null,2));
 console.info(JSON.stringify({summary,changedCommands:result.changedCommands}));
});
