import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { planningBudgets } from '../src/ai/planner';
import { planningBudgets as reference } from '../scripts/ai-versions/tactical-reinforcements-20261120/planner';
import { planningBudgets as extended } from '../scripts/ai-versions/extended-hard-20261120/planner';

it('isolates extra thinking time without changing search limits, strategy or the reference snapshot',()=>{
 expect(reference.hard.milliseconds).toBe(3200);
 expect(extended.hard.milliseconds).toBe(6400);
 expect(planningBudgets).toEqual(extended);
 expect({...extended.hard,milliseconds:reference.hard.milliseconds}).toEqual(reference.hard);
 expect(extended.normal).toEqual(reference.normal);
 const root='scripts/ai-versions/',a=root+'tactical-reinforcements-20261120/',b=root+'extended-hard-20261120/';
 const hash=(value:string)=>createHash('sha256').update(value.replace(/\r\n/g,'\n')).digest('hex');
 for(const directory of [a,b]){
  const manifest=JSON.parse(readFileSync(directory+'manifest.json','utf8'));
  for(const [name,checksum] of Object.entries(manifest.frozen))expect(hash(readFileSync(directory+name+'.ts','utf8'))).toBe(checksum);
  for(const [name,checksum] of Object.entries(manifest.rules))expect(hash(readFileSync('src/engine/'+name+'.ts','utf8'))).toBe(checksum);
 }
 const manifest=JSON.parse(readFileSync(a+'manifest.json','utf8'));
 for(const name of Object.keys(manifest.frozen)){
  let source=readFileSync(b+name+'.ts','utf8').replace(/\r\n/g,'\n');
  if(name==='planner')source=source.replace('  // Final safety checks share this ceiling; observed mean decisions are shorter.\n','').replace('milliseconds: 6400','milliseconds: 3200');
  expect(source.replace(/\r\n/g,'\n')).toBe(readFileSync(a+name+'.ts','utf8').replace(/\r\n/g,'\n'));
 }
});
