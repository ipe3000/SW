import { describe, expect, it } from 'vitest';
import { diverseMoves, needsFullReply, reinforcementValue, tacticalFamily } from '../src/ai/coverage';
import { newMatch, wizard } from '../src/engine/game';
import { evaluator } from '../src/ai/didactic';

describe('tactical coverage and strategic reinforcement', () => {
  it('preserves support for different allies alongside higher-scoring variants', () => {
    const game = newMatch().game;
    const activation = (targetId: string) => ({ wizardId: 'red:teleporter', before: [], after: [], spell: { kind: 'teleport' as const, targetId, destination: {x:4,y:4} } });
    const moves = ['red:spellsword','red:spellsword','red:spellsword','red:enchanter'].map(activation);
    const result = diverseMoves(moves, 3, move => tacticalFamily(game, move, game));
    expect(result.map(move => move.spell.targetId)).toContain('red:enchanter');
  });
  it('finishes replies in contact and controlled positions, not fresh distant openings', () => {
    const game = newMatch().game;
    expect(needsFullReply(game)).toBe(false);
    wizard(game,'red:geomancer')!.restrainedUntil=1;
    expect(needsFullReply(game)).toBe(true);
    delete wizard(game,'red:geomancer')!.restrainedUntil;
    wizard(game,'red:geomancer')!.pos={x:0,y:2};
    expect(needsFullReply(game)).toBe(true);
  });
  it('rewards a distant step even with several turns remaining, without rewarding movement within reach', () => {
    expect(reinforcementValue('enchanter',9)).toBeGreaterThan(reinforcementValue('enchanter',10));
    expect(reinforcementValue('enchanter',9)-reinforcementValue('enchanter',10)).toBeLessThan(1);
    expect(reinforcementValue('spellsword',25)).toBeGreaterThan(reinforcementValue('spellsword',26));
    expect(reinforcementValue('aeromancer',2)).toBe(reinforcementValue('aeromancer',3));
    expect(reinforcementValue('spellsword',30)).toBeGreaterThanOrEqual(-9.6);
  });
  it('rewards reinforcements for both colours while preserving terminal priorities', () => {
    for (const side of ['red','blue'] as const) {
      const base=newMatch().game; base.active=side;
      base.walls=[];
      // Isolate a safe, distant reinforcement. A crowded opening may correctly
      // penalize advancing into several enemies; it is not this scenario.
      base.wizards=base.wizards.filter(w => w.id===`${side}:enchanter` || w.id===`${side==='red'?'blue':'red'}:geomancer`);
      wizard(base,`${side}:enchanter`)!.pos={x:0,y:side==='red'?9:0};
      base.wizards.find(w=>w.side!==side)!.pos={x:9,y:side==='red'?0:9};
      const advance=structuredClone(base);
      wizard(advance,`${side}:enchanter`)!.pos!.y+=side==='red'?-1:1;
      const evaluate=evaluator(base,true);
      expect(evaluate(advance)).toBeGreaterThan(evaluate(base));
      advance.pending={winner:side,loser:side==='red'?'blue':'red',reason:'test'};
      expect(evaluate(advance)).toBe(1_000_000);
    }
  });
});
