import { describe, expect, it } from 'vitest';
import { evaluator } from '../src/ai/didactic';
import { defaultOptions, newMatch, wizard } from '../src/engine/game';

function position() {
  const game = newMatch(defaultOptions, () => .8).game;
  game.walls = []; game.turn = 2;
  game.wizards = game.wizards.filter(w => w.kind === 'spellsword');
  wizard(game, 'red:spellsword')!.pos = { x: 1, y: 1 };
  wizard(game, 'blue:spellsword')!.pos = { x: 8, y: 8 };
  return game;
}

describe.each([false, true])('Iniziativa comune: valutazione tattica %s', tactical => {
  it.each(['red', 'blue'] as const)('premia un avvicinamento sicuro anche in una posizione simmetrica, lato %s', side => {
    const base = position(); base.active = side;
    const next = structuredClone(base);
    wizard(next, `${side}:spellsword`)!.pos = side === 'red' ? { x: 2, y: 1 } : { x: 7, y: 8 };
    const evaluate = evaluator(base, tactical);
    expect(evaluate(next)).toBeGreaterThan(evaluate(base));
  });

  it('preferisce moderatamente uno scambio di danni pari, senza equipararlo alla perdita di un mago', () => {
    const base = position(), trade = structuredClone(base), sacrifice = structuredClone(base);
    for (const mage of trade.wizards) mage.hp--;
    sacrifice.wizards = sacrifice.wizards.filter(w => w.side !== 'red');
    const evaluate = evaluator(base, tactical), gain = evaluate(trade) - evaluate(base);
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThan(3);
    expect(evaluate(sacrifice)).toBeLessThan(evaluate(base) - 70);
  });
});
