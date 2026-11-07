import { describe, expect, it } from 'vitest';
import { activate, defaultOptions, endTurn, newMatch, wizard, type Activation, type Game, type Kind, type Side } from '../src/engine/game';
import { presentActivation, presentChange } from '../src/engine/presentation';

function setup() { const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); match.game.turn = 2; return match; }
function put(g: Game, side: Side, kind: Kind, x: number, y: number, hp = 4) { const w = wizard(g, `${side}:${kind}`)!; w.pos = { x, y }; w.hp = hp; return w; }
function present(g: Game, activation: Activation) { return presentActivation(g, activate(g, activation), activation, 1); }
const act = (kind: Kind, spell?: Activation['spell'], before: Activation['before'] = [], after: Activation['after'] = []): Activation => ({ wizardId: `red:${kind}`, before, spell, after });

describe('Sequenza osservabile delle regole', () => {
  it('segue movimento, abilità, danni e movimento restante senza mutare il salvataggio', () => {
    const { game: g } = setup(); put(g, 'red', 'spellsword', 4, 4); put(g, 'blue', 'geomancer', 5, 3);
    const original = structuredClone(g), a = act('spellsword', { kind: 'sword', targetId: 'blue:geomancer' }, [{ x: 4, y: 3 }], [{ x: 4, y: 4 }]);
    const sequence = present(g, a), hit = sequence.frames.findIndex(f => f.title === 'Danno');
    expect(sequence.frames[1].game.wizards.find(w => w.id === a.wizardId)?.pos).toEqual({ x: 4, y: 3 });
    expect(sequence.frames[hit].cues[0].text).toContain('4 → 2');
    expect(wizard(sequence.frames[hit + 1].game, a.wizardId)?.pos).toEqual({ x: 4, y: 4 });
    expect(sequence.frames.at(-1)?.game).toEqual(activate(g, a)); expect(g).toEqual(original);
  });
  it('mostra zero PV prima della rimozione e la copia svanita come conseguenza dei danni', () => {
    const { game: g } = setup(); put(g, 'red', 'spellsword', 4, 4); put(g, 'blue', 'illusionist', 5, 4, 1);
    g.copies.push({ ownerId: 'blue:illusionist', side: 'blue', pos: { x: 6, y: 4 } });
    const sequence = present(g, act('spellsword', { kind: 'sword', targetId: 'blue:illusionist' }));
    const hit = sequence.frames.find(f => f.title === 'Danno')!, gone = sequence.frames.find(f => f.title === 'Eliminazioni e copie svanite')!;
    expect(wizard(hit.game, 'blue:illusionist')?.hp).toBe(0); expect(hit.game.copies).toHaveLength(1);
    expect(hit.cues[0].text).toContain('1 → 0'); expect(hit.cues[0].text).toContain('ELIMINATO');
    expect(wizard(gone.game, 'blue:illusionist')).toBeUndefined(); expect(gone.game.copies).toHaveLength(0);
    expect(gone.cues.map(c => c.text)).toEqual(['ELIMINATO', 'COPIA SVANITA']);
    expect(sequence.summary.join(' ')).toContain('perché il suo Illusionista ha subito danni');
  });
  it('raggruppa la scarica simultanea e conserva la sconfitta del lanciatore in caso di soglia doppia', () => {
    const { game: g } = setup();
    g.wizards = g.wizards.filter(w => ['electromancer', 'geomancer', 'aeromancer', 'spellsword'].includes(w.kind));
    put(g, 'red', 'electromancer', 4, 4); put(g, 'red', 'geomancer', 5, 4, 1); put(g, 'blue', 'spellsword', 6, 4, 1);
    const sequence = present(g, act('electromancer', { kind: 'lightning' }));
    const hits = sequence.frames.filter(f => f.title === 'Danni simultanei');
    expect(hits).toHaveLength(1); expect(hits[0].cues).toHaveLength(2);
    expect(hits[0].game.wizards.filter(w => w.hp === 0)).toHaveLength(2);
    expect(sequence.frames.at(-1)?.game.pending?.loser).toBe('red');
    expect(sequence.summary.at(-1)).toContain('provvisorio');
  });
  it('mostra danno prima del vento, compresi i singoli passi del bersaglio', () => {
    const { game: g } = setup(); put(g, 'red', 'aeromancer', 4, 4); put(g, 'blue', 'spellsword', 5, 4);
    const sequence = present(g, act('aeromancer', { kind: 'wind', targetId: 'blue:spellsword', path: [{ x: 5, y: 5 }, { x: 6, y: 5 }] }));
    const hit = sequence.frames.findIndex(f => f.title === 'Danno'), moves = sequence.frames.filter(f => f.title === 'Spostamento causato dal vento');
    expect(sequence.frames.indexOf(moves[0])).toBeGreaterThan(hit);
    expect(moves.map(f => wizard(f.game, 'blue:spellsword')?.pos)).toEqual([{ x: 5, y: 5 }, { x: 6, y: 5 }]);
  });
  it('distingue teletrasporto senza percorso ed evocazione, movimento e attacco della copia', () => {
    const { game: g } = setup(); put(g, 'red', 'teleporter', 4, 4); put(g, 'blue', 'spellsword', 2, 4);
    const tele = present(g, act('teleporter', { kind: 'teleport', targetId: 'blue:spellsword', destination: { x: 6, y: 4 } }));
    const frame = tele.frames.find(f => f.title.startsWith('Teletrasporto'))!;
    expect(frame.path).toBeUndefined(); expect(frame.points).toEqual([{ x: 2, y: 4 }, { x: 6, y: 4 }]);
    put(g, 'red', 'illusionist', 4, 6); put(g, 'blue', 'spellsword', 6, 5);
    const copy = present(g, act('illusionist', { kind: 'illusion', summon: { x: 5, y: 6 }, path: [{ x: 6, y: 6 }], targetId: 'blue:spellsword' }));
    expect(copy.frames.findIndex(f => f.cues.some(c => c.text === 'COPIA EVOCATA'))).toBeLessThan(copy.frames.findIndex(f => f.title === 'Danno'));
    expect(copy.frames.find(f => f.path)?.game.copies[0].pos).toEqual({ x: 6, y: 6 });
  });
  it('evidenzia la croce del fuoco e segnala applicazione e scadenza dell’immobilizzazione', () => {
    const match = setup(), g = match.game; put(g, 'red', 'pyromancer', 4, 4); put(g, 'blue', 'spellsword', 5, 4);
    const fire = present(g, act('pyromancer', { kind: 'fireball', center: { x: 4, y: 4 } }));
    expect(fire.frames.find(f => f.title.includes('Palla di fuoco'))?.points).toHaveLength(5);
    put(g, 'red', 'geomancer', 4, 6);
    const earth = present(g, act('geomancer', { kind: 'earth', targetId: 'blue:spellsword' }));
    expect(earth.frames.find(f => f.title === 'Immobilizzazione')?.details[0]).toContain('prossimo turno Blu');
    const last = earth.frames.at(-1)!.game; last.active = 'blue'; last.turn = 3;
    const change = presentChange({ ...match, game: last }, { ...match, revision: 2, game: endTurn(last) });
    expect(change?.summary.join(' ')).toContain('immobilizzazione terminata');
  });
  it('non ripete una mossa per cambi di velocità e distingue annullamento da replay', () => {
    const match = setup();
    expect(presentChange(match, { ...match, revision: 1 })).toBeNull();
    const next = { ...match, revision: 2, game: { ...match.game, log: ['Conferma'] } };
    expect(presentChange(next, { ...match, revision: 3 })?.kind).toBe('undo');
  });
});
