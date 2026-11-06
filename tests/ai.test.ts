import { describe, expect, it } from 'vitest';
import { activate, charmed, defaultOptions, newMatch, wizard, type Kind, type Match, type Side } from '../src/engine/game';
import { importMatch, readMatch } from '../src/engine/backup';
import { activationSeeds } from '../src/ai/candidates';
import { didactic } from '../src/ai/didactic';
import { applyComputerCommand, commitComputerCommand } from '../src/ai/types';

function battle() { const value = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); value.game.turn = 2; return value; }
function put(value: Match, side: Side, kind: Kind, x: number, y: number, hp = 4) { const w = wizard(value.game, `${side}:${kind}`)!; w.pos = { x, y }; w.hp = hp; return w; }

describe('Computer didattico: regole condivise', () => {
  const kinds: [Kind, string][] = [['aeromancer', 'wind'], ['electromancer', 'lightning'], ['enchanter', 'touch'], ['geomancer', 'earth'], ['illusionist', 'illusion'], ['pyromancer', 'fireball'], ['spellsword', 'sword'], ['teleporter', 'teleport']];
  it.each(kinds)('genera abilità legali per %s', (kind, spell) => {
    const value = battle(); put(value, 'red', kind, 4, 4); put(value, 'blue', 'spellsword', kind === 'illusionist' ? 6 : 5, 4);
    const original = structuredClone(value.game), choices = [...activationSeeds(value.game, `red:${kind}`)];
    expect(choices.some(c => c.activation.spell?.kind === spell)).toBe(true);
    for (const c of choices) expect(activate(value.game, c.activation)).toEqual(c.game);
    expect(value.game).toEqual(original);
  });
  it('rispetta immobilizzazione, incantamento iniziale e semiattivazione', () => {
    const value = battle(); const w = put(value, 'red', 'spellsword', 4, 4); put(value, 'blue', 'enchanter', 5, 4); w.restrainedUntil = 2;
    expect(charmed(value.game, w)).toBe(true); expect([...activationSeeds(value.game, w.id)]).toHaveLength(0);
    delete w.restrainedUntil;
    expect([...activationSeeds(value.game, w.id)].every(c => !c.activation.spell)).toBe(true);
    value.game.phase = 2; value.game.activity = true;
    expect([...activationSeeds(value.game)].every(c => !c.activation.spell && c.activation.before.length === 1)).toBe(true);
  });
  it('sceglie una vittoria immediata e non modifica lo stato ricevuto', () => {
    const value = battle(); put(value, 'red', 'spellsword', 4, 4); put(value, 'blue', 'spellsword', 5, 4, 2);
    value.game.wizards = value.game.wizards.filter(w => w.side === 'red' || ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
    const original = structuredClone(value.game), decision = didactic.choose(value.game);
    const next = applyComputerCommand(value.game, decision.command);
    expect(next.pending?.winner).toBe('red'); expect(value.game).toEqual(original);
    expect(didactic.choose(value.game)).toEqual(decision);
  }, 20000);
  it('evita una scarica che farebbe perdere anche il lanciatore', () => {
    const value = battle(); put(value, 'red', 'electromancer', 4, 4); put(value, 'red', 'illusionist', 5, 4, 1); put(value, 'blue', 'spellsword', 6, 4, 1);
    value.game.wizards = value.game.wizards.filter(w => w.side === 'red' ? ['electromancer', 'illusionist', 'geomancer', 'pyromancer'].includes(w.kind) : ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
    const decision = didactic.choose(value.game), next = applyComputerCommand(value.game, decision.command);
    expect(next.pending?.loser).not.toBe('red');
  }, 20000);
  it('schiera automaticamente e conserva modalità e gilda nei backup', () => {
    let value: Match = { ...newMatch({ ...defaultOptions, placement: 'custom' }), computer: { profile: 'didactic-v1', side: 'red' } };
    for (let i = 0; i < 4; i++) value = commitComputerCommand(value, didactic.choose(value.game).command);
    expect(value.game.active).toBe('blue'); expect(value.undo).toHaveLength(0);
    expect(importMatch(JSON.stringify(value))).toEqual(value);
    expect(() => commitComputerCommand(value, { kind: 'end-turn' })).toThrow('turno del computer');
    expect(() => readMatch({ ...value, computer: { profile: 'unknown', side: 'red' } })).toThrow('non compatibile');
    expect(() => readMatch({ ...value, computer: { profile: 'didactic-v1', side: 'green' } })).toThrow('Colore');
    expect(importMatch(JSON.stringify(newMatch())).computer).toBeUndefined();
    const legacy = { ...newMatch(), version: 1 };
    expect(importMatch(JSON.stringify(legacy))).toEqual(legacy);
    expect(() => readMatch({ ...value, version: 1 })).toThrow('formato di salvataggio 2');
  });
  it('conclude i risultati provvisori senza riaprire le mosse', () => {
    const value = battle(); put(value, 'red', 'spellsword', 4, 4); put(value, 'blue', 'spellsword', 5, 4, 1);
    value.game.wizards = value.game.wizards.filter(w => w.side === 'red' || ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
    value.game = activate(value.game, { wizardId: 'red:spellsword', before: [], after: [], spell: { kind: 'sword', targetId: 'blue:spellsword' } });
    const decision = didactic.choose(value.game); expect(decision.command.kind).toBe('end-turn');
    expect(applyComputerCommand(value.game, decision.command).stage).toBe('finished');
  });
  it('avanza dal proprio schieramento senza consumare abilità a vuoto', () => {
    const g = newMatch().game, start = performance.now(), decision = didactic.choose(g), next = applyComputerCommand(g, decision.command);
    expect(decision.command.kind).toBe('activate'); expect(next.activity).toBe(true); expect(next.phase).toBe(3);
    expect(performance.now() - start).toBeLessThan(6000);
  }, 10000);
  it('usa la scarica quando è il modo più diretto di vincere', () => {
    const value = battle(); put(value, 'red', 'electromancer', 4, 4); put(value, 'blue', 'spellsword', 4, 5, 1);
    value.game.wizards = value.game.wizards.filter(w => w.side === 'red' || ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
    const decision = didactic.choose(value.game);
    expect(decision.command.kind).toBe('activate');
    if (decision.command.kind === 'activate') expect(decision.command.activation.spell?.kind).toBe('lightning');
    expect(applyComputerCommand(value.game, decision.command).pending?.winner).toBe('red');
  }, 10000);
  it('può colpire e usare il movimento residuo per proteggere un mago ferito', () => {
    const value = battle(); put(value, 'red', 'spellsword', 4, 4, 1); put(value, 'blue', 'geomancer', 5, 4);
    const decision = didactic.choose(value.game);
    expect(decision.command.kind).toBe('activate');
    if (decision.command.kind === 'activate') {
      expect(decision.command.activation.spell?.kind).toBe('sword');
      expect(decision.command.activation.after.length).toBeGreaterThan(0);
    }
    const next = applyComputerCommand(value.game, decision.command);
    expect(wizard(next, 'blue:geomancer')!.hp).toBe(2);
  }, 10000);
});

describe('Simulazioni riproducibili', () => {
  it('esegue entrambi i colori e tutte le fasi usando soltanto mosse legali', () => {
    const start = performance.now(); let g = newMatch({ ...defaultOptions, hp: 3, walls: 'varied' }, () => .8).game;
    const initial = structuredClone(g); const phases = new Set<number>(), abilities = new Set<string>();
    for (let i = 0; i < 100 && g.stage !== 'finished'; i++) {
      phases.add(g.phase); const decision = didactic.choose(g);
      if (decision.command.kind === 'activate' && decision.command.activation.spell) abilities.add(decision.command.activation.spell.kind);
      const next = applyComputerCommand(g, decision.command);
      readMatch({ format: 'strategic-wizardry-local', version: 1, revision: i, game: next, undo: [], savedAt: new Date().toISOString() });
      expect(next.stage === 'finished' || next.turn >= g.turn).toBe(true);
      g = next;
    }
    expect(phases).toContain(0); expect(phases).toContain(1); expect(phases).toContain(2); expect(phases).toContain(3);
    expect(abilities.size).toBeGreaterThan(0);
    expect(g.wizards.length).toBeLessThan(initial.wizards.length);
    expect(g.stage).toBe('finished');
    console.info(JSON.stringify({ simulation: 'didactic-v1', elapsedMs: Math.round(performance.now() - start), turns: g.turn, stage: g.stage, abilities: [...abilities] }));
  }, 120000);
});
