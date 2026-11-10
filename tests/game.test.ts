import { describe, expect, it } from 'vitest';
import { activate, charmed, commitActivation, copyRoute, count, createGame, defaultOptions, deploymentInfo, endTurn, finishTurn, hasSight, INFO, newMatch, placeWizard, previewActivation, route, skipPhase, targetPoints, undoActivation, wizard, type Activation, type Game, type Kind, type Side } from '../src/engine/game';
import { importMatch, readMatch } from '../src/engine/backup';
import { distance, same, visible } from '../src/engine/geometry';
import { duelChronicle } from '../src/engine/chronicle';

const id = (side: Side, kind: Kind) => `${side}:${kind}`;
function battle(): Game { const g = createGame({ ...defaultOptions, walls: 'varied' }, () => .8); g.turn = 2; return g; }
function put(g: Game, side: Side, kind: Kind, x: number, y: number, hp = 4) { const w = wizard(g, id(side, kind))!; w.pos = { x, y }; w.hp = hp; return w; }
function act(kind: Kind, spell?: Activation['spell'], before: Activation['before'] = [], after: Activation['after'] = []): Activation { return { wizardId: id('red', kind), before, spell, after }; }

describe('Preparazione e geometria', () => {
  it('schiera sedici maghi con punti vita e ordine del diagramma', () => {
    const g = createGame();
    expect(g.wizards).toHaveLength(16);
    expect(wizard(g, 'red:electromancer')!.pos).toEqual({ x: 1, y: 9 });
    expect(wizard(g, 'red:spellsword')!.pos).toEqual({ x: 8, y: 9 });
    expect(wizard(g, 'blue:spellsword')!.pos).toEqual({ x: 1, y: 0 });
    expect(wizard(g, 'blue:electromancer')!.pos).toEqual({ x: 8, y: 0 });
    expect(g.wizards.every(w => w.hp === 4)).toBe(true);
  });
  it('colloca i muri secondo i dadi e supporta tutte le varianti dei punti vita', () => {
    const dice = [0, .999], g = createGame({ ...defaultOptions, hp: 5 }, () => dice.shift()!);
    expect(g.walls).toEqual([{ x: 2, y: 4 }, { x: 7, y: 5 }]);
    expect(g.wizards.every(w => w.hp === 5)).toBe(true);
    const values = [4, 5, 0, 3];
    const alternative = createGame({ ...defaultOptions, hp: 3, walls: 'varied' }, () => (values.shift()! + .1) / 6);
    expect(alternative.dice).toEqual([5, 6, 1, 4]);
    expect(alternative.walls).toEqual([{ x: 5, y: 4 }, { x: 8, y: 5 }]);
    expect(alternative.wizards.every(w => w.hp === 3)).toBe(true);
  });
  it('segue la sequenza di schieramento personalizzato 4-6-2-2-2', () => {
    let g = createGame({ ...defaultOptions, placement: 'custom' });
    const batches: string[] = [];
    while (g.stage === 'deployment') {
      const [side, quota] = deploymentInfo(g); batches.push(`${side}:${quota}`);
      for (let i = 0; i < quota; i++) {
        const candidate = g.wizards.find(w => w.side === side && !w.pos)!;
        const occupied = g.wizards.filter(w => w.side === side && w.pos).length;
        g = placeWizard(g, candidate.id, { x: occupied + 1, y: side === 'red' ? 9 : 0 });
      }
    }
    expect(batches).toEqual(['red:4', 'blue:6', 'red:2', 'blue:2', 'red:2']);
    expect(g.wizards.every(w => w.pos)).toBe(true); expect(g.active).toBe('red'); expect(g.turn).toBe(0);
  });
  it('consente il singolo angolo sfiorato ma blocca due caselle sullo stesso angolo', () => {
    expect(visible({ x: 0, y: 0 }, { x: 2, y: 2 }, [{ x: 1, y: 0 }])).toBe(true);
    expect(visible({ x: 0, y: 0 }, { x: 2, y: 2 }, [{ x: 1, y: 0 }, { x: 0, y: 1 }])).toBe(false);
    expect(visible({ x: 0, y: 0 }, { x: 2, y: 1 }, [{ x: 1, y: 0 }])).toBe(false);
  });
  it('le copie alleate sono trasparenti, quelle nemiche bloccano la visuale', () => {
    const g = battle();
    g.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 4, y: 4 } }];
    expect(hasSight(g, { x: 3, y: 4 }, { x: 5, y: 4 }, 'red')).toBe(true);
    expect(hasSight(g, { x: 3, y: 4 }, { x: 5, y: 4 }, 'blue')).toBe(false);
    put(g, 'red', 'geomancer', 4, 4);
    expect(hasSight(g, { x: 3, y: 4 }, { x: 5, y: 4 }, 'red')).toBe(false);
  });
});
describe('Movimento e turno', () => {
  it('attraversa alleati ma non vi termina, non agisce da una casella occupata', () => {
    const g = battle(); put(g, 'red', 'spellsword', 4, 4); put(g, 'red', 'geomancer', 5, 4); put(g, 'blue', 'aeromancer', 5, 3);
    expect(route(g, wizard(g, 'red:spellsword')!, { x: 6, y: 4 })).toHaveLength(2);
    expect(() => activate(g, act('spellsword', undefined, [{ x: 5, y: 4 }]))).toThrow('libera');
    expect(() => activate(g, act('spellsword', { kind: 'sword', targetId: 'blue:aeromancer' }, [{ x: 5, y: 4 }]))).toThrow('occupata');
  });
  it('supporta movimento, azione e movimento residuo nello stesso budget', () => {
    const g = battle(); put(g, 'red', 'spellsword', 4, 4); put(g, 'blue', 'geomancer', 5, 3);
    const next = activate(g, act('spellsword', { kind: 'sword', targetId: 'blue:geomancer' }, [{ x: 4, y: 3 }], [{ x: 4, y: 4 }]));
    expect(wizard(next, 'blue:geomancer')!.hp).toBe(2); expect(wizard(next, 'red:spellsword')!.pos).toEqual({ x: 4, y: 4 });
  });
  it('nel primo turno il Rosso ha una sola attivazione', () => {
    const g = createGame();
    const next = activate(g, act('aeromancer', undefined, [{ x: 5, y: 8 }]));
    expect(next.phase).toBe(3);
    expect(() => activate(next, act('geomancer'))).toThrow('fase');
    expect(endTurn(next).active).toBe('blue');
  });
  it('richiede tre maghi distinti e limita la semiattivazione a un passo senza azione', () => {
    let g = battle();
    g = activate(g, act('aeromancer', undefined, [{ x: 5, y: 8 }]));
    expect(() => activate(g, act('aeromancer'))).toThrow('non ancora');
    g = activate(g, act('geomancer', undefined, [{ x: 2, y: 8 }]));
    expect(g.phase).toBe(2);
    expect(() => activate(g, act('illusionist', undefined, [{ x: 6, y: 8 }, { x: 6, y: 7 }]))).toThrow('movimento');
    expect(() => activate(g, act('illusionist', { kind: 'illusion', summon: { x: 6, y: 8 }, path: [] }))).toThrow('Semiattivazione'.toLowerCase());
    expect(activate(g, act('illusionist', undefined, [{ x: 6, y: 8 }])).phase).toBe(3);
  });
  it('non consente di passare il turno senza attività o di eluderlo con attivazioni vuote', () => {
    const g = battle();
    expect(() => endTurn(g)).toThrow('almeno');
    const firstPassed = skipPhase(g);
    expect(() => skipPhase(firstPassed)).toThrow('Almeno');
    expect(() => activate(firstPassed, act('aeromancer'))).toThrow('Almeno');
    const moved = activate(g, act('aeromancer', undefined, [{ x: 5, y: 8 }]));
    expect(endTurn(moved).active).toBe('blue');
  });
  it('permette il passaggio quando nessun mago può muovere o agire', () => {
    const g = battle();
    g.wizards = g.wizards.filter(w => w.side === 'blue' || ['electromancer', 'enchanter', 'geomancer', 'spellsword'].includes(w.kind));
    g.wizards.filter(w => w.side === 'red').forEach((w, i) => { w.pos = { x: i * 3, y: 8 }; });
    for (const w of g.wizards.filter(w => w.side === 'red')) w.restrainedUntil = 2;
    // Separate the remaining wizards: no targets, allied chain or forced movement.
    expect(endTurn(g).active).toBe('blue');
  });
});
describe('Poteri e capacità passive', () => {
  it('l’incantamento resta dopo essersi allontanati, ma non scatta entrando nell’adiacenza', () => {
    const g = battle(); put(g, 'red', 'aeromancer', 4, 4); put(g, 'blue', 'enchanter', 3, 4); put(g, 'blue', 'geomancer', 6, 4);
    expect(charmed(g, wizard(g, 'red:aeromancer')!)).toBe(true);
    expect(() => activate(g, act('aeromancer', { kind: 'wind', targetId: 'blue:geomancer', path: [] }, [{ x: 4, y: 5 }]))).toThrow('iniziato');
    put(g, 'red', 'aeromancer', 4, 6);
    const next = activate(g, act('aeromancer', { kind: 'wind', targetId: 'blue:geomancer', path: [] }, [{ x: 4, y: 5 }, { x: 4, y: 4 }]));
    expect(wizard(next, 'blue:geomancer')!.hp).toBe(3);
  });
  it('il vento sposta anche verso il lanciatore e respinge le azioni alleate senza effetto finale', () => {
    const g = battle(); put(g, 'red', 'aeromancer', 3, 4); put(g, 'red', 'geomancer', 5, 4);
    const next = activate(g, act('aeromancer', { kind: 'wind', targetId: 'red:geomancer', path: [{ x: 4, y: 4 }] }));
    expect(wizard(next, 'red:geomancer')!.pos).toEqual({ x: 4, y: 4 }); expect(wizard(next, 'red:geomancer')!.hp).toBe(4);
    expect(() => activate(g, act('aeromancer', { kind: 'wind', targetId: 'red:geomancer', path: [] }))).toThrow('senza effetti');
    expect(() => activate(g, act('aeromancer', { kind: 'wind', targetId: 'red:geomancer', path: [{ x: 5, y: 5 }, { x: 5, y: 4 }] }))).toThrow('senza effetti');
  });
  it('il vento danneggia prima di spostare e non muove un mago eliminato', () => {
    const g = battle(); put(g, 'red', 'aeromancer', 4, 4); put(g, 'blue', 'geomancer', 6, 4, 1);
    const next = activate(g, act('aeromancer', { kind: 'wind', targetId: 'blue:geomancer', path: [] }));
    expect(wizard(next, 'blue:geomancer')).toBeUndefined();
    expect(() => activate(g, act('aeromancer', { kind: 'wind', targetId: 'blue:geomancer', path: [{ x: 6, y: 5 }] }))).toThrow('eliminato');
  });
  it('immobilizza il movimento proprio ma consente azioni e teletrasporto; scade a fine turno del controllore', () => {
    let g = battle(); put(g, 'red', 'geomancer', 4, 4); put(g, 'blue', 'spellsword', 6, 4); put(g, 'red', 'teleporter', 5, 5); put(g, 'red', 'pyromancer', 7, 4);
    g = activate(g, act('geomancer', { kind: 'earth', targetId: 'blue:spellsword' }));
    expect(wizard(g, 'blue:spellsword')!.restrainedUntil).toBe(3);
    const transported = activate(g, act('teleporter', { kind: 'teleport', targetId: 'blue:spellsword', destination: { x: 5, y: 3 } }));
    expect(wizard(transported, 'blue:spellsword')!.restrainedUntil).toBe(3);
    g = endTurn(g);
    expect(() => activate(g, { wizardId: 'blue:spellsword', before: [{ x: 6, y: 5 }], after: [] })).toThrow('movimento');
    g = activate(g, { wizardId: 'blue:spellsword', before: [], after: [], spell: { kind: 'sword', targetId: 'red:pyromancer' } });
    expect(wizard(g, 'red:pyromancer')!.hp).toBe(2);
    expect(wizard(endTurn(g), 'blue:spellsword')!.restrainedUntil).toBeUndefined();
  });
  it('la scarica percorre l’intero gruppo prima delle eliminazioni e colpisce anche alleati', () => {
    const g = battle(); put(g, 'red', 'electromancer', 4, 4); put(g, 'red', 'illusionist', 5, 4, 1); put(g, 'blue', 'spellsword', 6, 4, 1); put(g, 'blue', 'geomancer', 7, 4); put(g, 'blue', 'pyromancer', 8, 5);
    g.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 6, y: 6 } }];
    const next = activate(g, act('electromancer', { kind: 'lightning' }));
    expect(wizard(next, 'red:electromancer')!.hp).toBe(4);
    expect(wizard(next, 'red:illusionist')).toBeUndefined(); expect(wizard(next, 'blue:spellsword')).toBeUndefined();
    expect(wizard(next, 'blue:geomancer')!.hp).toBe(3); expect(wizard(next, 'blue:pyromancer')!.hp).toBe(4);
    expect(next.copies).toHaveLength(0);
  });
  it('la palla di fuoco vede soltanto il centro e risparmia gli alleati', () => {
    const g = battle(); put(g, 'red', 'pyromancer', 4, 4); put(g, 'red', 'teleporter', 5, 4); put(g, 'blue', 'spellsword', 5, 5); g.walls = [{ x: 4, y: 5 }];
    expect(hasSight(g, { x: 4, y: 4 }, { x: 5, y: 5 }, 'red')).toBe(false);
    const next = activate(g, act('pyromancer', { kind: 'fireball', center: { x: 5, y: 4 } }));
    expect(wizard(next, 'blue:spellsword')!.hp).toBe(3); expect(wizard(next, 'red:teleporter')!.hp).toBe(4); expect(wizard(next, 'red:pyromancer')!.hp).toBe(4);
    expect(() => activate(g, act('pyromancer', { kind: 'fireball', center: { x: 4, y: 5 } }))).toThrow('muro');
  });
  it('la palla di fuoco può essere centrata sul Piromante, ma non essere lanciata a vuoto', () => {
    const g = battle(); put(g, 'red', 'pyromancer', 4, 4); put(g, 'blue', 'spellsword', 4, 5);
    const next = activate(g, act('pyromancer', { kind: 'fireball', center: { x: 4, y: 4 } }));
    expect(wizard(next, 'blue:spellsword')!.hp).toBe(3); expect(wizard(next, 'red:pyromancer')!.hp).toBe(4);
    expect(() => activate(g, act('pyromancer', { kind: 'fireball', center: { x: 3, y: 3 } }))).toThrow('senza effetti');
  });
  it('il teletrasporto misura entrambe le posizioni dal lanciatore, fino a quattro caselle di spostamento', () => {
    const g = battle(); put(g, 'red', 'teleporter', 4, 4); const target = put(g, 'blue', 'spellsword', 2, 4);
    const next = activate(g, act('teleporter', { kind: 'teleport', targetId: target.id, destination: { x: 6, y: 4 } }));
    expect(distance(target.pos!, wizard(next, target.id)!.pos!)).toBe(4);
    expect(() => activate(g, act('teleporter', { kind: 'teleport', targetId: 'red:teleporter', destination: { x: 4, y: 3 } }))).toThrow('altro');
  });
  it('evoca, muove e usa la copia; non permette un comando senza effetti', () => {
    const g = battle(); put(g, 'red', 'illusionist', 4, 4); put(g, 'blue', 'spellsword', 6, 6);
    const next = activate(g, act('illusionist', { kind: 'illusion', summon: { x: 5, y: 4 }, path: [{ x: 5, y: 5 }, { x: 6, y: 5 }], targetId: 'blue:spellsword' }));
    expect(next.copies[0].pos).toEqual({ x: 6, y: 5 }); expect(wizard(next, 'blue:spellsword')!.hp).toBe(3);
    const existing = { ...g, copies: next.copies };
    expect(() => activate(existing, act('illusionist', { kind: 'illusion', path: [] }))).toThrow('senza effetti');
    expect(activate(g, act('illusionist', { kind: 'illusion', summon: { x: 5, y: 4 }, path: [] })).copies).toHaveLength(1);
  });
  it('controlla ogni passo della copia e consente di lasciarla oltre gittata dopo l’azione', () => {
    const g = battle(); put(g, 'red', 'illusionist', 4, 4); put(g, 'blue', 'spellsword', 6, 4);
    g.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 5, y: 4 } }];
    const next = activate(g, act('illusionist', { kind: 'illusion', path: [], targetId: 'blue:spellsword' }, [], [{ x: 4, y: 3 }, { x: 4, y: 2 }, { x: 4, y: 1 }]));
    expect(distance(wizard(next, 'red:illusionist')!.pos!, next.copies[0].pos)).toBe(4);
    expect(targetPoints(next, wizard(next, 'red:illusionist')!)).toEqual([]);
    expect(() => activate(g, act('illusionist', { kind: 'illusion', path: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }] }))).toThrow('tre caselle');
  });
  it('la copia attraversa alleati e non può essere bersaglio del teletrasporto', () => {
    const g = battle(); const caster = put(g, 'red', 'illusionist', 4, 4); put(g, 'red', 'geomancer', 5, 3);
    const copy = { ownerId: caster.id, side: 'red' as const, pos: { x: 5, y: 4 } }; g.copies = [copy];
    expect(copyRoute(g, caster, copy, { x: 5, y: 2 })).toHaveLength(2);
    put(g, 'red', 'teleporter', 4, 5);
    expect(() => activate(g, act('teleporter', { kind: 'teleport', targetId: 'copy:red', destination: { x: 3, y: 5 } }))).toThrow('altro');
  });
  it('nessun mago può agire mentre è incantato, anche l’Illusionista', () => {
    const g = battle(); put(g, 'red', 'illusionist', 4, 4); put(g, 'blue', 'enchanter', 3, 4);
    expect(() => activate(g, act('illusionist', { kind: 'illusion', summon: { x: 5, y: 4 }, path: [] }))).toThrow('iniziato');
  });
});
describe('Risultato provvisorio, annullamento e salvataggi', () => {
  it('ferma le mosse alla quinta eliminazione e permette annullamento fino a Termina turno', () => {
    const g = battle(); put(g, 'red', 'spellsword', 4, 4); put(g, 'blue', 'spellsword', 5, 4, 1);
    g.wizards = g.wizards.filter(w => w.side === 'red' || ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
    const match = { ...newMatch(), game: g };
    const confirmed = commitActivation(match, act('spellsword', { kind: 'sword', targetId: 'blue:spellsword' }));
    expect(count(confirmed.game, 'blue')).toBe(3); expect(confirmed.game.pending!.winner).toBe('red');
    expect(confirmed.game.stage).toBe('playing');
    expect(() => activate(confirmed.game, act('geomancer'))).toThrow('fase');
    expect(() => previewActivation(g, act('spellsword', { kind: 'sword', targetId: 'blue:spellsword' }, [], [{ x: 4, y: 3 }]))).toThrow('soglia');
    expect(undoActivation(confirmed).game).toEqual(g);
    const finished = finishTurn(confirmed);
    expect(finished.game.stage).toBe('finished'); expect(finished.game.result!.winner).toBe('red');
    expect(() => undoActivation(finished)).toThrow('annullare');
  });
  it('se la scarica porta entrambe le gilde a tre maghi perde chi l’ha lanciata', () => {
    const g = battle(); put(g, 'red', 'electromancer', 4, 4); put(g, 'red', 'illusionist', 5, 4, 1); put(g, 'blue', 'spellsword', 6, 4, 1);
    g.wizards = g.wizards.filter(w => w.side === 'red' ? ['electromancer', 'illusionist', 'geomancer', 'pyromancer'].includes(w.kind) : ['spellsword', 'aeromancer', 'enchanter', 'teleporter'].includes(w.kind));
    const match = commitActivation({ ...newMatch(), game: g }, act('electromancer', { kind: 'lightning' }));
    const next = match.game;
    expect(count(next, 'red')).toBe(3); expect(count(next, 'blue')).toBe(3); expect(next.pending!.loser).toBe('red');
    const story = duelChronicle(finishTurn(match).game).join(' ');
    expect(story).toMatch(/Elettromante Rosso/);
    expect(story).toContain('L’Illusionista Rosso e la Lamarcana Blu caddero');
    expect(story).toContain('la scarica era partita dalla Gilda Rossa, fu lei a cedere il campo alla Gilda Blu');
  });
  it('conserva la partita e l’annullamento, rifiuta versioni e sovrapposizioni corrotte', () => {
    const initial = newMatch();
    const confirmed = commitActivation(initial, act('aeromancer', undefined, [{ x: 5, y: 8 }]));
    expect(importMatch(JSON.stringify(confirmed))).toEqual(confirmed);
    expect(readMatch(undoActivation(confirmed)).game).toEqual(initial.game);
    expect(() => importMatch(JSON.stringify({ ...confirmed, version: 3 }))).toThrow('compatibile');
    const corrupt = structuredClone(confirmed); corrupt.game.wizards[0].pos = corrupt.game.wizards[1].pos;
    expect(() => readMatch(corrupt)).toThrow('stessa casella');
    expect(() => readMatch({ ...confirmed, undo: [{ ...initial.game, turn: 99 }] })).toThrow('turno');
  });
});
