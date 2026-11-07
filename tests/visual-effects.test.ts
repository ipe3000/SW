import { expect, it } from 'vitest';
import { activate, defaultOptions, endTurn, newMatch, wizard, type Game, type Kind, type Side, type Activation } from '../src/engine/game';
import { distance } from '../src/engine/geometry';
import { presentActivation, presentChange } from '../src/engine/presentation';
import { charmInfluence } from '../src/engine/visual-effects';
function setup() { const match = newMatch({ ...defaultOptions, walls: 'varied' }, () => .8); match.game.turn = 2; return match; }
function put(g: Game, side: Side, kind: Kind, x: number, y: number, hp = 4) { const w = wizard(g, `${side}:${kind}`)!; w.pos = { x, y }; w.hp = hp; }
function show(g: Game, a: Activation) { const snapshot = structuredClone(g), after = activate(g, a), p = presentActivation(g, after, a, 1); expect(g).toEqual(snapshot); expect(p.frames.at(-1)!.game).toEqual(after); return p; }
it('l’influenza mostra tutti i nemici adiacenti, escludendo alleati, diagonali e copie', () => {
  const { game } = setup(); put(game, 'blue', 'enchanter', 4, 4); put(game, 'red', 'spellsword', 3, 4); put(game, 'red', 'geomancer', 4, 5); put(game, 'red', 'pyromancer', 5, 5); put(game, 'blue', 'geomancer', 5, 4);
  game.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 4, y: 3 } }];
  const original = structuredClone(game), links = charmInfluence(game);
  expect(links.map(l => l.targetId).sort()).toEqual(['red:geomancer', 'red:spellsword']); expect(links.every(l => l.sourceId === 'blue:enchanter')).toBe(true); expect(game).toEqual(original);
  wizard(game, 'blue:enchanter')!.hp = 0; expect(charmInfluence(game)).toHaveLength(0);
});
it('il cuore incatenato dipende dall’inizio dell’attivazione e finisce con essa', () => {
  const { game } = setup(); put(game, 'red', 'spellsword', 4, 4); put(game, 'blue', 'enchanter', 5, 4);
  const p = show(game, { wizardId: 'red:spellsword', before: [{ x: 4, y: 3 }], after: [] });
  expect(p.frames.slice(0, -1).every(f => f.charmedId === 'red:spellsword')).toBe(true); expect(p.frames.at(-1)!.charmedId).toBeUndefined();
  put(game, 'blue', 'enchanter', 6, 4);
  const later = show(game, { wizardId: 'red:spellsword', before: [{ x: 5, y: 4 }], spell: { kind: 'sword', targetId: 'blue:enchanter' }, after: [] });
  expect(later.frames.every(f => !f.charmedId)).toBe(true);
});
it('danno, teschio e dissoluzione della copia sono eventi distinti collegati al proprietario corretto', () => {
  const { game } = setup(); put(game, 'red', 'spellsword', 4, 4); put(game, 'blue', 'illusionist', 5, 4, 1); game.copies = [{ ownerId: 'blue:illusionist', side: 'blue', pos: { x: 6, y: 4 } }];
  const p = show(game, { wizardId: 'red:spellsword', before: [], spell: { kind: 'sword', targetId: 'blue:illusionist' }, after: [] });
  const hit = p.frames.find(f => f.cues.some(c => c.kind === 'damage'))!, removed = p.frames.find(f => f.ghosts?.length)!;
  expect(hit.cues[0]).toMatchObject({ amount: 2, symbol: 'damage' }); expect(removed.cues.map(c => c.symbol)).toEqual(['skull', 'dissolve']);
  expect(removed.ghosts).toHaveLength(2); expect(removed.visuals![0]).toMatchObject({ kind: 'dissolve', origin: { x: 5, y: 4 }, points: [{ x: 6, y: 4 }] });
  expect(removed.game.wizards.some(w => w.id === 'blue:illusionist')).toBe(false);
});
it('i fulmini seguono solo adiacenze reali e il danno resta simultaneo, anche agli alleati', () => {
  const { game } = setup(); put(game, 'red', 'electromancer', 4, 4); put(game, 'red', 'geomancer', 5, 4); put(game, 'blue', 'spellsword', 6, 4);
  game.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 4, y: 3 } }];
  const p = show(game, { wizardId: 'red:electromancer', before: [], spell: { kind: 'lightning' }, after: [] });
  const fx = p.frames.find(f => f.visuals?.[0]?.kind === 'lightning')!.visuals![0]; expect(fx.links).toHaveLength(2); expect(fx.links!.every(([a, b]) => distance(a, b) === 1)).toBe(true); expect(fx.points).not.toContainEqual({ x: 4, y: 3 });
  expect(p.frames.filter(f => f.cues.some(c => c.kind === 'damage'))).toHaveLength(1); expect(p.frames.find(f => f.title === 'Danni simultanei')!.cues).toHaveLength(2);
});
it('il teletrasporto conserva partenza e arrivo senza fingere un movimento intermedio', () => {
  const { game } = setup(); put(game, 'red', 'teleporter', 4, 4); put(game, 'blue', 'spellsword', 2, 4);
  const p = show(game, { wizardId: 'red:teleporter', before: [], spell: { kind: 'teleport', targetId: 'blue:spellsword', destination: { x: 6, y: 4 } }, after: [] });
  const f = p.frames.find(f => f.ghosts?.some(g => g.departing))!; expect(f.visuals![0].points).toEqual([{ x: 2, y: 4 }, { x: 6, y: 4 }]); expect(f.movement).toBeUndefined(); expect(f.ghosts![0].wizard.pos).toEqual({ x: 2, y: 4 });
});
it('annullare un comando della copia marca entrambe le posizioni con l’orologio', () => {
  const before = setup(), after = structuredClone(before); before.game.log = ['Movimento copia'];
  before.game.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 5, y: 7 } }]; after.game.copies = [{ ownerId: 'red:illusionist', side: 'red', pos: { x: 5, y: 8 } }];
  const p = presentChange(before, after)!; expect(p.kind).toBe('undo'); expect(p.frames[0].visuals![0]).toMatchObject({ kind: 'undo', points: expect.arrayContaining([{ x: 5, y: 7 }, { x: 5, y: 8 }]) });
});
it('la fine dell’immobilizzazione rimuove le radici e produce il segnale di rilascio', () => {
  const m = setup(); m.game.active = 'blue'; m.game.turn = 3; m.game.activity = true; wizard(m.game, 'blue:spellsword')!.restrainedUntil = 3;
  const after = { ...m, game: endTurn(m.game), revision: 1 }, p = presentChange(m, after)!;
  expect(p.frames[0].visuals![0]).toMatchObject({ kind: 'release', points: [{ x: 1, y: 0 }] }); expect(wizard(after.game, 'blue:spellsword')!.restrainedUntil).toBeUndefined();
});
