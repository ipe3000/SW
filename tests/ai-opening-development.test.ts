import { describe, expect, it } from 'vitest';
import { evaluator } from '../src/ai/didactic';
import { newMatch, wizard } from '../src/engine/game';

describe('Hard quiet-opening development', () => {
  it.each(['red', 'blue'] as const)('prefers developing an attacker over a support-only shuffle for %s', side => {
    const base = newMatch().game; base.active = side;
    const attacker = structuredClone(base), support = structuredClone(base);
    wizard(attacker, `${side}:spellsword`)!.pos!.y += side === 'red' ? -2 : 2;
    wizard(support, `${side}:teleporter`)!.pos!.y += side === 'red' ? -2 : 2;
    const old = evaluator(base, true), improved = evaluator(base, true, true);
    const bonus = (game: typeof base) => improved(game) - old(game);
    expect(bonus(attacker)).toBeGreaterThan(bonus(support));
    expect(bonus(support)).toBe(0);
  });

  it('does not reward moving an illusion copy alone', () => {
    const base = newMatch().game, next = structuredClone(base);
    next.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 6, y: 6 } }];
    expect(evaluator(base, true, true)(next)).toBe(evaluator(base, true)(next));
  });

  it('bounds positional preference below one HP and keeps a developing line continuous at contact', () => {
    const base = newMatch().game, next = structuredClone(base);
    for (const mage of next.wizards.filter(w => w.side === 'red')) mage.pos!.y = 3;
    const bonus = evaluator(base, true, true)(next) - evaluator(base, true)(next);
    expect(bonus).toBeCloseTo(6.75);
    next.wizards[0].hp--;
    expect(evaluator(base, true, true)(next) - evaluator(base, true)(next)).toBeCloseTo(6.75);
  });

  it('leaves damaged, controlled, close and terminal searches unchanged', () => {
    const fresh = newMatch().game;
    const damaged = structuredClone(fresh); damaged.wizards[0].hp--;
    const controlled = structuredClone(fresh); controlled.wizards[0].restrainedUntil = 2;
    const close = structuredClone(fresh); close.wizards[0].pos!.y = 5;
    for (const base of [damaged, controlled, close]) {
      const next = structuredClone(base); wizard(next, 'red:spellsword')!.pos!.y--;
      expect(evaluator(base, true, true)(next)).toBe(evaluator(base, true)(next));
    }
    fresh.pending = { winner: 'red', loser: 'blue', reason: 'test' };
    expect(evaluator(fresh, true, true)(fresh)).toBe(1_000_000);
  });

});
