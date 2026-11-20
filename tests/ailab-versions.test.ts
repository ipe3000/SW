import {expect,it} from 'vitest';
import {casesFor,defaults} from '../src/ailab/model';
it('swaps versions even at equal difficulty on identical fields',()=>{
const cases=casesFor({...defaults,mode:'pair',a:'normal',b:'normal',engineA:'1',engineB:'2',fields:1});
expect(cases).toHaveLength(2);
expect(cases.map(c=>[c.redEngine,c.blueEngine])).toEqual([['1','2'],['2','1']]);
expect(cases[0].seed).toBe(cases[1].seed);
});
