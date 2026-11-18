import { expect, it } from 'vitest';
import { casesFor, defaults, initialGame, markdown, repetitionKey, statistics, sameLevelStatistics, physicalPositionKey, phaseStatistics, type Campaign, type Result } from '../src/ailab/model';

it('pairs every matchup on identical fields and swaps difficulty assignments', () => {
  const cases = casesFor(defaults);
  expect(cases).toHaveLength(18);
  for (let index = 0; index < cases.length; index += 2) {
    const a = cases[index], b = cases[index + 1];
    expect(a.red).toBe(b.blue); expect(a.blue).toBe(b.red);
    expect(initialGame(a)).toEqual(initialGame(b));
  }
  expect(new Set(cases.map(test => test.hp))).toEqual(new Set([3,4,5]));
  expect(new Set(cases.map(test => test.walls))).toEqual(new Set(['standard','varied']));
  expect(() => casesFor({ ...defaults, fields: 0 })).toThrow();
  expect(() => casesFor({ ...defaults, limit: NaN })).toThrow();
});

it('runs only equal-level games without duplicate color swaps and counts initiative once',()=>{
 const cases=casesFor({...defaults,mode:'self',fields:2});
 expect(cases).toHaveLength(6);expect(cases.every(test=>test.red===test.blue&&!test.reversed)).toBe(true);
 expect(new Set(cases.map(test=>test.fieldKey)).size).toBe(2);
 expect(casesFor({...defaults,mode:'pair',a:'easy',b:'easy',fields:2})).toHaveLength(2);
 const test=cases[0];const base:Result={test,outcome:'red',steps:[],final:initialGame(test),findings:[],audits:{completed:0,interrupted:0},elapsed:0};
 const rows=[base,{...base,outcome:'blue' as const},{...base,outcome:'limit' as const}];
 expect(sameLevelStatistics(rows)[0]).toMatchObject({games:3,first:1,second:1,incomplete:1,firstPercent:50,fields:1});
 expect(sameLevelStatistics([{...base,outcome:'error'}])[0].firstPercent).toBeNull();
 const campaign:Campaign={format:'strategic-wizardry-ailab',schema:1,id:'self',created:'2026-11-19',build:'test',userAgent:'test',config:{...defaults,mode:'self'},cases,results:rows};
 expect(markdown(campaign)).toContain('Iniziativa a parità di livello');
});

it('deduplicates all 36 standard boards and rejects impossible sample sizes', () => {
  const config = { ...defaults, hp:4 as const, walls:'standard' as const, fields:36 };
  const cases=casesFor(config);
  expect(new Set(cases.map(test=>physicalPositionKey(initialGame(test)))).size).toBe(36);
  expect(casesFor(config)).toEqual(cases);
  expect(()=>casesFor({...config,fields:37})).toThrow(/36/);
  expect(new Set(casesFor({...defaults,hp:4,walls:'standard'}).map(test=>test.fieldKey)).size).toBe(3);
});

it('recognizes repetitions across turn numbers without discarding restraint duration', () => {
  const game = initialGame(casesFor(defaults)[0]);
  expect(repetitionKey(game)).toBe(repetitionKey({ ...game, turn: game.turn + 2 }));
  const restrained = structuredClone(game); restrained.wizards[0].restrainedUntil = game.turn + 1;
  expect(repetitionKey(restrained)).not.toBe(repetitionKey(game));
});

it('exports inconclusive outcomes and proven tactical findings with trace references', () => {
  const test = casesFor(defaults)[0], game = initialGame(test);
  const campaign: Campaign = { format: 'strategic-wizardry-ailab', schema: 1, id: 'test', created: '2026-11-18', build: 'fingerprint', userAgent: 'test', config: defaults, cases: [test], results: [{ test, outcome: 'limit', steps: [], final: game, findings: [{ kind: 'missed-win', step: 4, side: 'red', alternative: { kind: 'skip' } }], elapsed: 0, audits: { completed: 1, interrupted: 1 } }] };
  const report = markdown(campaign);
  expect(report).toContain('fingerprint'); expect(report).toContain('comando 5');
  expect(report).toContain('limit'); expect(report).toContain('non sono vittorie');
  expect(report).toContain('Catalogo dei campi'); expect(report).toContain('legacy');
  expect(phaseStatistics(campaign.results)).toEqual([]);
  expect(statistics(campaign.results).map(row => row.incomplete)).toEqual([1, 1]);
  expect(statistics([{ ...campaign.results[0], test: { ...test, red: 'easy', blue: 'easy' }, outcome: 'red' }])[0]).toMatchObject({ wins: 1, losses: 1, incomplete: 0 });
});
