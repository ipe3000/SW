import { adjacent, distance, inside, same, shortestPath, square, visible, type Point } from './geometry';
export type { Point } from './geometry';
export type Side = 'red' | 'blue';
export type Kind = 'aeromancer' | 'electromancer' | 'enchanter' | 'geomancer' | 'illusionist' | 'pyromancer' | 'spellsword' | 'teleporter';
export type Wizard = { id: string; side: Side; kind: Kind; hp: number; pos: Point | null; restrainedUntil?: number };
export type Copy = { ownerId: string; side: Side; pos: Point };
export type Options = { hp: 3 | 4 | 5; walls: 'standard' | 'varied'; placement: 'standard' | 'custom'; redName: string; blueName: string };
export type Result = { winner: Side; loser: Side; reason: string };
export type Game = {
  version: 1; id: string; options: Options; walls: Point[]; dice: number[]; wizards: Wizard[]; copies: Copy[];
  stage: 'deployment' | 'playing' | 'finished'; deployment: { step: number; count: number };
  active: Side; turn: number; phase: number; activated: string[]; activity: boolean;
  pending: Result | null; result: Result | null; log: string[];
  chronicle?: readonly ChronicleEvent[];
};
export type Spell =
  | { kind: 'wind'; targetId: string; path: Point[] }
  | { kind: 'lightning' }
  | { kind: 'touch' | 'earth' | 'sword'; targetId: string }
  | { kind: 'illusion'; summon?: Point; path: Point[]; targetId?: string }
  | { kind: 'fireball'; center: Point }
  | { kind: 'teleport'; targetId: string; destination: Point };
export type Activation = { wizardId: string; before: Point[]; spell?: Spell; after: Point[] };
export type ChronicleEvent = {
  turn: number;
  activation: Activation;
  charmedBy?: string;
  effects: { kind: 'damage' | 'removed' | 'move' | 'restrain' | 'fade'; wizardId: string }[];
};
export type Effect = { kind: 'damage' | 'removed' | 'move' | 'restrain' | 'copy'; text: string; wizardId?: string; amount?: number; fromHp?: number; at?: Point };
export type Preview = { game: Game; effects: Effect[]; steps: number; charmed: boolean };
/** Optional observation of a resolution. Snapshots are for presentation, never legal game states to save. */
export type ResolutionEvent = { kind: 'move' | 'ability' | 'damage' | 'removed' | 'restrain' | 'copy' | 'wind' | 'teleport'; game: Game; actorId: string; effects?: Effect[]; path?: Point[]; copyOwner?: string; points?: Point[] };
export type ResolutionObserver = (event: ResolutionEvent) => void;
export type ComputerSpeed = 'slowest' | 'slow' | 'normal' | 'fast' | 'instant';
export type ComputerDifficulty = 'easy' | 'normal' | 'hard';
export type ComputerDifficulties = Partial<Record<Side, ComputerDifficulty>>;
export type ComputerOpponent = { profile: 'didactic-v1'; side: Side | 'both'; speed?: ComputerSpeed; difficulty?: ComputerDifficulties };
export type TurnReplay = { side: Side; turn: number; start: Game; end: Game; entries: { before: Game; after: Game; activation: Activation; logLength: number }[] };
export type Match = { format: 'strategic-wizardry-local'; version: 1 | 2; revision: number; game: Game; undo: Game[]; savedAt: string; computer?: ComputerOpponent; replays?: { current?: TurnReplay; red?: TurnReplay; blue?: TurnReplay } };

export const KINDS: Kind[] = ['aeromancer', 'electromancer', 'enchanter', 'geomancer', 'illusionist', 'pyromancer', 'spellsword', 'teleporter'];
export const INFO: Record<Kind, { name: string; short: string; speed: number; range: number; ability: string; description: string; portrait: number }> = {
  aeromancer: { name: 'Aeromante', short: 'AER', speed: 3, range: 3, ability: 'Vento impetuoso', description: 'Scegli un altro mago visibile entro 3. Un nemico subisce 1 danno; un alleato nessuno. Poi spostalo di 0–2 passi ortogonali su caselle vuote, in qualsiasi direzione.', portrait: 3 },
  electromancer: { name: 'Elettromante', short: 'ELE', speed: 4, range: 0, ability: 'Scarica a catena', description: 'Tutti i maghi collegati a te da adiacenze ortogonali subiscono 1 danno, alleati compresi. Tu sei immune. Le copie non conducono la scarica.', portrait: 7 },
  enchanter: { name: 'Incantatore', short: 'INC', speed: 4, range: 1, ability: 'Tocco psichico', description: 'Infliggi 1 danno a un nemico adiacente. Passiva: un nemico che inizia la propria attivazione accanto a te non può usare la sua abilità per tutta quell’attivazione.', portrait: 1 },
  geomancer: { name: 'Geomante', short: 'GEO', speed: 3, range: 3, ability: 'Presa della terra', description: 'Un nemico visibile entro 3 subisce 1 danno e non può muoversi fino alla fine del suo prossimo turno. Può agire ed essere spostato da vento o teletrasporto.', portrait: 6 },
  illusionist: { name: 'Illusionista', short: 'ILL', speed: 3, range: 1, ability: 'Copia illusoria', description: 'Evoca una copia adiacente se assente, poi muovila di 0–3 passi. L’intero percorso deve restare entro 3 dall’Illusionista. Può infliggere 1 danno a un nemico adiacente. Svanisce appena subisci danni.', portrait: 2 },
  pyromancer: { name: 'Piromante', short: 'PIR', speed: 3, range: 2, ability: 'Palla di fuoco', description: 'Scegli una casella visibile entro 2, anche la tua, senza muro. I nemici in quella casella e nelle quattro adiacenti subiscono 1 danno. Gli alleati sono immuni; basta vedere il centro.', portrait: 5 },
  spellsword: { name: 'Lamarcana', short: 'LAM', speed: 4, range: 1, ability: 'Lama arcana', description: 'Infliggi 2 danni a un nemico ortogonalmente adiacente.', portrait: 0 },
  teleporter: { name: 'Teletrasportatore', short: 'TEL', speed: 3, range: 2, ability: 'Teletrasporto', description: 'Sposta un altro mago visibile entro 2 su una casella vuota, anch’essa visibile ed entro 2 da te. Il percorso intermedio non conta.', portrait: 4 }
};
export const other = (side: Side): Side => side === 'red' ? 'blue' : 'red';
export const sideName = (side: Side) => side === 'red' ? 'Rosso' : 'Blu';
export const defaultOptions: Options = { hp: 4, walls: 'standard', placement: 'standard', redName: 'Gilda Rossa', blueName: 'Gilda Blu' };
const DEPLOY: [Side, number][] = [['red', 4], ['blue', 6], ['red', 2], ['blue', 2], ['red', 2]];
const BLUE_ORDER: Kind[] = ['spellsword', 'enchanter', 'illusionist', 'aeromancer', 'teleporter', 'pyromancer', 'geomancer', 'electromancer'];
const clone = <T,>(value: T): T => structuredClone(value);
function cloneGame({ chronicle, ...game }: Game): Game {
  return { ...clone(game), ...(chronicle ? { chronicle } : {}) };
}
function requireRule(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export const wizard = (g: Game, id: string) => g.wizards.find(w => w.id === id);
export const at = (g: Game, pos: Point, ignore?: string) => g.wizards.find(w => w.id !== ignore && w.pos && same(w.pos, pos));
export const copyAt = (g: Game, pos: Point, ignoreOwner?: string) => g.copies.find(c => c.ownerId !== ignoreOwner && same(c.pos, pos));
export const isWall = (g: Game, pos: Point) => g.walls.some(w => same(w, pos));
export const empty = (g: Game, pos: Point, ignore?: string) => inside(pos) && !isWall(g, pos) && !at(g, pos, ignore) && !copyAt(g, pos);
export const count = (g: Game, side: Side) => g.wizards.filter(w => w.side === side).length;
export const phaseName = (g: Game) => g.stage === 'deployment' ? 'Schieramento' : g.phase === 0 ? 'Prima attivazione' : g.phase === 1 ? 'Seconda attivazione' : g.phase === 2 ? 'Semiattivazione' : 'Concludi il turno';
export function createGame(options: Options = defaultOptions, random = Math.random): Game {
  requireRule([3, 4, 5].includes(options.hp), 'Punti vita iniziali non validi.');
  const dice = Array.from({ length: options.walls === 'standard' ? 2 : 4 }, () => Math.max(1, Math.min(6, Math.floor(random() * 6) + 1)));
  const walls = options.walls === 'standard' ? dice.map((die, i) => ({ x: die + 1, y: 4 + i })) : dice.flatMap((die, i) => die > 4 ? [] : [{ x: 1 + i * 2 + (die - 1) % 2, y: 4 + Math.floor((die - 1) / 2) }]);
  const wizards: Wizard[] = (['blue', 'red'] as Side[]).flatMap(side => (side === 'blue' ? BLUE_ORDER : [...BLUE_ORDER].reverse()).map((kind, i) => ({ id: `${side}:${kind}`, side, kind, hp: options.hp, pos: options.placement === 'custom' ? null : { x: i + 1, y: side === 'blue' ? 0 : 9 } })));
  return { version: 1, id: crypto.randomUUID(), options: { ...options, redName: options.redName.trim().slice(0, 40) || 'Gilda Rossa', blueName: options.blueName.trim().slice(0, 40) || 'Gilda Blu' }, walls, dice, wizards, copies: [], stage: options.placement === 'custom' ? 'deployment' : 'playing', deployment: { step: 0, count: 0 }, active: 'red', turn: 0, phase: 0, activated: [], activity: false, pending: null, result: null, log: [] };
}
export function deploymentInfo(g: Game) { return DEPLOY[g.deployment.step] ?? DEPLOY[4]; }
export function placeWizard(g: Game, id: string, pos: Point): Game {
  requireRule(g.stage === 'deployment', 'Lo schieramento è già terminato.');
  const [side, quota] = deploymentInfo(g), w = wizard(g, id);
  requireRule(w && w.side === side && !w.pos, 'Scegli un mago ancora da schierare della gilda attiva.');
  requireRule(pos.y === (side === 'red' ? 9 : 0) && pos.x >= 1 && pos.x <= 8 && empty(g, pos), 'Schiera nelle otto caselle centrali della tua prima riga.');
  const next = cloneGame(g); wizard(next, id)!.pos = { ...pos }; next.deployment.count++;
  if (next.deployment.count === quota) {
    next.deployment = { step: next.deployment.step + 1, count: 0 };
    if (next.deployment.step === DEPLOY.length) { next.stage = 'playing'; next.active = 'red'; }
    else next.active = deploymentInfo(next)[0];
  }
  return next;
}
export function canEnter(g: Game, pos: Point, side: Side, ignoreId?: string, ignoreCopy?: string): boolean {
  return inside(pos) && !isWall(g, pos) && !g.wizards.some(w => w.id !== ignoreId && w.side !== side && w.pos && same(w.pos, pos)) && !g.copies.some(c => c.ownerId !== ignoreCopy && c.side !== side && same(c.pos, pos));
}
export function hasSight(g: Game, from: Point, to: Point, side: Side): boolean {
  return visible(from, to, [...g.walls, ...g.wizards.flatMap(w => w.pos ? [w.pos] : []), ...g.copies.filter(c => c.side !== side).map(c => c.pos)]);
}
function adjacentEnchanter(g: Game, w: Wizard): Wizard | undefined {
  const pos = w.pos;
  if (!pos) return undefined;
  return g.wizards.find(enemy => enemy.side !== w.side && enemy.kind === 'enchanter' && enemy.pos && distance(enemy.pos, pos) === 1);
}

export function charmed(g: Game, w: Wizard): boolean {
  return Boolean(adjacentEnchanter(g, w));
}
export function speed(g: Game, w: Wizard) { return w.restrainedUntil !== undefined ? 0 : g.phase === 2 ? 1 : INFO[w.kind].speed; }
export function route(g: Game, w: Wizard, to: Point, max = speed(g, w)): Point[] | null {
  if (!w.pos) return null;
  return shortestPath(w.pos, to, max, p => canEnter(g, p, w.side, w.id), p => empty(g, p, w.id));
}
function walk(g: Game, origin: Point, path: Point[], maximum: number, side: Side, ignoreId?: string, force = false, copyOwner?: string, anchor?: Point, freeEnd = true): Point {
  requireRule(Array.isArray(path) && path.length <= maximum, 'Il percorso supera il movimento disponibile.');
  let previous = origin;
  for (const p of path) {
    requireRule(inside(p) && distance(previous, p) === 1, 'Il movimento procede di una casella ortogonale alla volta.');
    const pass = force ? empty(g, p, ignoreId) : canEnter(g, p, side, ignoreId, copyOwner);
    requireRule(pass, 'Il percorso attraversa un muro o un pezzo che blocca il passaggio.');
    requireRule(!anchor || distance(anchor, p) <= 3, 'La copia deve restare entro tre caselle dall’Illusionista lungo tutto il percorso.');
    previous = p;
  }
  if (freeEnd) requireRule(!isWall(g, previous) && !at(g, previous, ignoreId) && !copyAt(g, previous, copyOwner), 'Il movimento deve terminare su una casella libera.');
  return { ...previous };
}
function physical(g: Game) { return JSON.stringify({ wizards: g.wizards, copies: g.copies }); }
function result(g: Game, caster: Side) {
  const red = count(g, 'red') <= 3, blue = count(g, 'blue') <= 3;
  if (!red && !blue) return;
  const loser = red && blue ? caster : red ? 'red' : 'blue';
  g.pending = { loser, winner: other(loser), reason: red && blue ? 'Entrambe le gilde hanno tre maghi o meno: perde chi ha lanciato la scarica.' : `La gilda ${sideName(loser)} è rimasta con tre maghi o meno.` };
}
function damage(g: Game, targets: string[], amount: number, effects: Effect[], observe?: ResolutionObserver, actorId = '') {
  const start = effects.length;
  for (const id of targets) {
    const target = wizard(g, id); if (!target) continue;
    const fromHp = target.hp;
    target.hp = Math.max(0, target.hp - amount);
    effects.push({ kind: 'damage', wizardId: id, amount, fromHp, at: target.pos ?? undefined, text: `${INFO[target.kind].name} ${sideName(target.side)}: −${amount} PV (${fromHp} → ${target.hp}).` });
    if (target.hp === 0) effects.push({ kind: 'removed', wizardId: id, at: target.pos ?? undefined, text: `${INFO[target.kind].name} ${sideName(target.side)} eliminato.` });
  }
  observe?.({ kind: 'damage', game: g, actorId, effects: effects.slice(start).filter(e => e.kind === 'damage') });
  for (const id of targets) {
    const copy = g.copies.find(c => c.ownerId === id);
    if (copy) { g.copies = g.copies.filter(c => c.ownerId !== id); effects.push({ kind: 'copy', wizardId: id, at: copy.pos, text: `La copia ${sideName(copy.side)} svanisce perché il suo Illusionista ha subito danni.` }); }
  }
  g.wizards = g.wizards.filter(w => w.hp > 0);
  const consequences = effects.slice(start).filter(e => e.kind !== 'damage');
  if (consequences.length) observe?.({ kind: 'removed', game: g, actorId, effects: consequences });
}
export function lightningTargets(g: Game, caster: Wizard): Wizard[] {
  const affected = [caster], seen = new Set([caster.id]);
  for (let i = 0; i < affected.length; i++) for (const w of g.wizards) {
    if (!seen.has(w.id) && w.pos && affected[i].pos && distance(w.pos, affected[i].pos!) === 1) { seen.add(w.id); affected.push(w); }
  }
  return affected.filter(w => w.id !== caster.id);
}
function aim(g: Game, caster: Wizard, point: Point, range = INFO[caster.kind].range) {
  requireRule(caster.pos && inside(point) && distance(caster.pos, point) <= range && hasSight(g, caster.pos, point, caster.side), 'Il bersaglio deve essere entro gittata e visibile.');
}
function targetWizard(g: Game, caster: Wizard, id: string, enemy = false) {
  const target = wizard(g, id);
  requireRule(target && target.pos && target.id !== caster.id, 'Scegli un altro mago sulla scacchiera.');
  requireRule(!enemy || target.side !== caster.side, 'L’abilità richiede un mago nemico.'); aim(g, caster, target.pos);
  return target;
}
export const SPELL_KIND: Record<Kind, Spell['kind']> = { aeromancer: 'wind', electromancer: 'lightning', enchanter: 'touch', geomancer: 'earth', illusionist: 'illusion', pyromancer: 'fireball', spellsword: 'sword', teleporter: 'teleport' };
function resolveSpell(g: Game, caster: Wizard, spell: Spell, effects: Effect[], allowIncomplete: boolean, observe?: ResolutionObserver) {
  requireRule(spell.kind === SPELL_KIND[caster.kind], 'Questa abilità non appartiene al mago selezionato.');
  requireRule(caster.pos && empty(g, caster.pos, caster.id), 'Non puoi usare un’abilità mentre attraversi una casella occupata.');
  const before = physical(g);
  const points = !observe ? [] : spell.kind === 'fireball' ? [spell.center, ...adjacent(spell.center)] : spell.kind === 'lightning' ? lightningTargets(g, caster).flatMap(w => w.pos ? [w.pos] : []) : 'targetId' in spell && spell.targetId ? [wizard(g, spell.targetId)?.pos].filter((p): p is Point => Boolean(p)) : [];
  observe?.({ kind: 'ability', game: g, actorId: caster.id, points });
  switch (spell.kind) {
    case 'wind': {
      const target = targetWizard(g, caster, spell.targetId);
      if (target.side !== caster.side) damage(g, [target.id], 1, effects, observe, caster.id);
      const survivor = wizard(g, target.id);
      if (!survivor) { requireRule(spell.path.length === 0, 'Un mago eliminato non può essere spostato.'); break; }
      const old = { ...survivor.pos! };
      survivor.pos = walk(g, survivor.pos!, spell.path, 2, survivor.side, survivor.id, true);
      if (!same(old, survivor.pos)) effects.push({ kind: 'move', wizardId: survivor.id, at: survivor.pos, text: `${INFO[survivor.kind].name} spostato da ${square(old)} a ${square(survivor.pos)}.` });
      if (spell.path.length) observe?.({ kind: 'wind', game: g, actorId: survivor.id, path: [old, ...spell.path] });
      break;
    }
    case 'lightning': damage(g, lightningTargets(g, caster).map(w => w.id), 1, effects, observe, caster.id); break;
    case 'touch': case 'earth': case 'sword': {
      const target = targetWizard(g, caster, spell.targetId, true);
      damage(g, [target.id], spell.kind === 'sword' ? 2 : 1, effects, observe, caster.id);
      const survivor = wizard(g, target.id);
      if (spell.kind === 'earth' && survivor) { survivor.restrainedUntil = g.turn + 1; effects.push({ kind: 'restrain', wizardId: survivor.id, text: `${INFO[survivor.kind].name} immobilizzato fino alla fine del prossimo turno ${sideName(survivor.side)}.` }); }
      if (spell.kind === 'earth' && survivor) observe?.({ kind: 'restrain', game: g, actorId: caster.id, effects: effects.slice(-1), points: [survivor.pos!] });
      break;
    }
    case 'fireball': {
      aim(g, caster, spell.center);
      requireRule(!isWall(g, spell.center), 'Il centro della palla di fuoco non può contenere un muro.');
      damage(g, g.wizards.filter(w => w.side !== caster.side && w.pos && distance(w.pos, spell.center) <= 1).map(w => w.id), 1, effects, observe, caster.id);
      break;
    }
    case 'teleport': {
      const target = targetWizard(g, caster, spell.targetId);
      aim(g, caster, spell.destination);
      requireRule(empty(g, spell.destination), 'La destinazione del teletrasporto deve essere vuota.');
      const old = target.pos!; target.pos = { ...spell.destination };
      effects.push({ kind: 'move', wizardId: target.id, at: target.pos, text: `${INFO[target.kind].name}: teletrasporto ${square(old)} → ${square(target.pos)}.` });
      observe?.({ kind: 'teleport', game: g, actorId: target.id, points: [old, target.pos], effects: effects.slice(-1) });
      break;
    }
    case 'illusion': {
      let copy = g.copies.find(c => c.ownerId === caster.id);
      if (!copy) {
        requireRule(spell.summon && empty(g, spell.summon), 'Scegli una casella vuota per evocare la copia.');
        aim(g, caster, spell.summon, 1);
        copy = { ownerId: caster.id, side: caster.side, pos: { ...spell.summon } }; g.copies.push(copy);
        effects.push({ kind: 'copy', at: copy.pos, text: `Copia ${sideName(copy.side)} evocata in ${square(copy.pos)}.` });
        observe?.({ kind: 'copy', game: g, actorId: caster.id, effects: effects.slice(-1), points: [copy.pos] });
      } else requireRule(!spell.summon, 'La copia è già presente: puoi comandarla, non evocarne un’altra.');
      requireRule(distance(copy.pos, caster.pos!) <= 3, 'La copia è oltre tre caselle: resta sul campo ma non può agire.');
      const old = { ...copy.pos };
      copy.pos = walk(g, copy.pos, spell.path, 3, copy.side, undefined, false, copy.ownerId, caster.pos!, !allowIncomplete);
      if (!same(old, copy.pos)) effects.push({ kind: 'copy', at: copy.pos, text: `Copia spostata da ${square(old)} a ${square(copy.pos)}.` });
      if (spell.path.length) observe?.({ kind: 'copy', game: g, actorId: caster.id, copyOwner: caster.id, path: [old, ...spell.path] });
      if (spell.targetId) {
        requireRule(!at(g, copy.pos), 'La copia deve terminare il movimento su una casella libera prima di colpire.');
        const target = wizard(g, spell.targetId);
        requireRule(target && target.side !== caster.side && target.pos && distance(copy.pos, target.pos) === 1, 'La copia può colpire un solo mago nemico adiacente.');
        damage(g, [target.id], 1, effects, observe, caster.id);
      }
      break;
    }
  }
  requireRule(allowIncomplete || physical(g) !== before, 'Un’abilità senza effetti sulla situazione finale non è consentita.');
  result(g, caster.side);
}
export function previewActivation(base: Game, activation: Activation, incomplete = false, observe?: ResolutionObserver): Preview {
  requireRule(base.stage === 'playing' && !base.pending && base.phase < 3, 'In questa fase non puoi attivare un mago.');
  const initial = wizard(base, activation.wizardId);
  requireRule(initial && initial.side === base.active && initial.pos && !base.activated.includes(initial.id), 'Scegli un mago della gilda attiva non ancora attivato in questo turno.');
  requireRule(base.turn !== 0 || base.phase === 0, 'Il Rosso nel primo turno svolge una sola attivazione.');
  const isCharmed = charmed(base, initial);
  const budget = speed(base, initial);
  requireRule(activation.before.length + activation.after.length <= budget, 'Il percorso supera il movimento disponibile.');
  const game = cloneGame(base), effects: Effect[] = [], caster = wizard(game, initial.id)!;
  caster.pos = walk(game, caster.pos!, activation.before, budget, caster.side, caster.id, false, undefined, undefined, false);
  if (activation.before.length) observe?.({ kind: 'move', game, actorId: caster.id, path: [initial.pos!, ...activation.before] });
  if (activation.spell) {
    requireRule(base.phase < 2, 'La semiattivazione non consente abilità.');
    requireRule(!isCharmed, 'Il mago ha iniziato l’attivazione accanto all’Incantatore nemico: può muovere, ma non agire.');
    resolveSpell(game, caster, activation.spell, effects, incomplete, observe);
  }
  requireRule(!game.pending || activation.after.length === 0, 'La soglia di sconfitta è stata raggiunta: non puoi effettuare altro movimento.');
  const afterOrigin = caster.pos!;
  caster.pos = walk(game, caster.pos!, activation.after, budget - activation.before.length, caster.side, caster.id, false, undefined, undefined, !incomplete);
  if (activation.after.length) observe?.({ kind: 'move', game, actorId: caster.id, path: [afterOrigin, ...activation.after] });
  if (!incomplete) requireRule(empty(game, caster.pos!, caster.id), 'Il mago deve terminare su una casella libera.');
  return { game, effects, steps: activation.before.length + activation.after.length, charmed: isCharmed };
}
export function activate(base: Game, activation: Activation, historical = false, recordChronicle = false): Game {
  const { game, effects, steps } = previewActivation(base, activation);
  requireRule(!(base.phase < 2 && !base.activity && steps === 0 && !activation.spell && (base.turn === 0 || base.phase === 1) && activityRequired(base, historical)), 'Almeno un mago deve muovere o agire durante le attivazioni complete.');
  const w = wizard(game, activation.wizardId)!;
  game.activated.push(w.id);
  if (base.phase < 2 && (steps > 0 || activation.spell)) game.activity = true;
  game.phase = base.turn === 0 ? 3 : base.phase + 1;
  const origin = wizard(base, w.id)!.pos!;
  const moved = steps ? ` · ${square(origin)} → ${square(w.pos!)}` : '';
  game.log.push(`${sideName(w.side)} · ${INFO[w.kind].name}${base.phase === 2 ? ' (semiattivazione)' : ''}${moved}${effects.length ? ': ' + effects.map(e => e.text).join(' ') : ''}`);
  const charmedBy = recordChronicle && !activation.spell && base.phase < 2
    ? adjacentEnchanter(base, wizard(base, w.id)!)?.id
    : undefined;
  if (recordChronicle && (activation.spell || charmedBy)) {
    const event: ChronicleEvent = {
      turn: base.turn,
      activation: clone(activation),
      ...(charmedBy ? { charmedBy } : {}),
      effects: effects.flatMap(({ kind, wizardId }) => wizardId ? [{ kind: kind === 'copy' ? 'fade' : kind, wizardId }] : []),
    };
    game.chronicle = [...(base.chronicle ?? []), event];
  }
  return game;
}
export function copyRoute(g: Game, caster: Wizard, copy: Copy, to: Point): Point[] | null {
  if (!caster.pos || distance(copy.pos, caster.pos) > 3) return null;
  return shortestPath(copy.pos, to, 3, p => distance(p, caster.pos!) <= 3 && canEnter(g, p, copy.side, undefined, copy.ownerId), p => !isWall(g, p) && !at(g, p) && !copyAt(g, p, copy.ownerId));
}
export function targetPoints(g: Game, w: Wizard): Point[] {
  if (!w.pos) return [];
  if (w.kind === 'electromancer') return lightningTargets(g, w).length ? [w.pos] : [];
  if (w.kind === 'illusionist') {
    const copy = g.copies.find(c => c.ownerId === w.id);
    if (!copy) return adjacent(w.pos).filter(p => empty(g, p));
    if (distance(copy.pos, w.pos) > 3) return [];
    const movable = Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) })).some(p => distance(copy.pos, p) <= 3 && Boolean(copyRoute(g, w, copy, p)?.length));
    const canHit = g.wizards.some(t => t.side !== w.side && t.pos && distance(t.pos, copy.pos) === 1);
    return movable || canHit ? [copy.pos] : [];
  }
  if (w.kind === 'pyromancer') {
    return Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) })).filter(p => distance(w.pos!, p) <= 2 && !isWall(g, p) && hasSight(g, w.pos!, p, w.side) && g.wizards.some(t => t.side !== w.side && t.pos && distance(t.pos, p) <= 1));
  }
  return g.wizards.filter(t => {
    if (!t.pos || t.id === w.id || distance(w.pos!, t.pos) > INFO[w.kind].range || !hasSight(g, w.pos!, t.pos, w.side)) return false;
    if (['enchanter', 'geomancer', 'spellsword'].includes(w.kind)) return t.side !== w.side;
    if (w.kind === 'aeromancer') return t.side !== w.side || adjacent(t.pos).some(p => empty(g, p, t.id));
    if (w.kind === 'teleporter') return teleportDestinations(g, w).length > 0;
    return false;
  }).map(t => t.pos!);
}
export function teleportDestinations(g: Game, caster: Wizard): Point[] {
  if (!caster.pos) return [];
  return Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) })).filter(p => empty(g, p) && distance(caster.pos!, p) <= 2 && hasSight(g, caster.pos!, p, caster.side));
}
export function hasActivity(g: Game): boolean {
  return g.wizards.some(w => w.side === g.active && w.pos && !g.activated.includes(w.id) && (
    speed(g, w) > 0 && adjacent(w.pos).some(p => canEnter(g, p, w.side, w.id) && (speed(g, w) >= 2 || empty(g, p, w.id))) ||
    !charmed(g, w) && targetPoints(g, w).length > 0
  ));
}
function activityRequired(g: Game, historical: boolean): boolean {
  const full = { ...g, phase: 0 };
  if (!hasActivity(full)) return false;
  if (!historical) return true;
  // Keep only the old exceptions readable, without accepting arbitrary empty turns in archives.
  return full.wizards.some(w => w.side === full.active && w.pos && (
    Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) })).some(p => Boolean(route(full, w, p)?.length)) ||
    !charmed(full, w) && targetPoints(full, w).length > 0
  ));
}
export function skipPhase(g: Game, historical = false): Game {
  requireRule(g.stage === 'playing' && !g.pending && g.phase < 3, 'Non ci sono fasi da passare.');
  requireRule(!(g.phase < 2 && !g.activity && (g.turn === 0 || g.phase === 1) && activityRequired(g, historical)), 'Almeno un mago deve muovere o agire durante le attivazioni complete.');
  const next = cloneGame(g); next.phase = g.turn === 0 ? 3 : next.phase + 1; next.log.push(`${sideName(g.active)} · ${phaseName(g)} passata.`); return next;
}
export function endTurn(g: Game, historical = false): Game {
  requireRule(g.stage === 'playing', 'La partita non è in corso.');
  requireRule(g.pending || g.activity || !activityRequired(g, historical), 'Prima di terminare il turno almeno un mago deve fare un passo o usare un’abilità.');
  const next = cloneGame(g);
  for (const w of next.wizards) if (w.side === next.active && w.restrainedUntil !== undefined && w.restrainedUntil <= next.turn) delete w.restrainedUntil;
  if (next.pending) { next.result = next.pending; next.pending = null; next.stage = 'finished'; next.log.push(`Vittoria ${sideName(next.result.winner)}. ${next.result.reason}`); }
  else { next.active = other(next.active); next.turn++; next.phase = 0; next.activated = []; next.activity = false; next.log.push(`Inizia il turno ${sideName(next.active)}.`); }
  return next;
}
export function newMatch(options: Options = defaultOptions, random = Math.random): Match { return { format: 'strategic-wizardry-local', version: 2, revision: 0, game: createGame(options, random), undo: [], savedAt: new Date().toISOString() }; }
const replaySnapshot = ({ chronicle: _chronicle, ...game }: Game): Game => clone({ ...game, log: [] });
/** Bounded, informational history: at most three activations per side, without the growing log. */
function recordTurn(before: Match, after: Match, activation?: Activation): Match {
  if (before.game.stage !== 'playing') return after;
  const previous = before.replays ?? {}, current = previous.current?.turn === before.game.turn && previous.current.side === before.game.active ? previous.current : { side: before.game.active, turn: before.game.turn, start: replaySnapshot(before.game), end: replaySnapshot(before.game), entries: [] };
  const recording: TurnReplay = { ...current, end: replaySnapshot(after.game), entries: activation ? [...current.entries, { before: replaySnapshot(before.game), after: replaySnapshot(after.game), activation: clone(activation), logLength: after.game.log.length }] : current.entries };
  if (after.game.turn !== before.game.turn || after.game.stage === 'finished') {
    const { current: _current, ...completed } = previous;
    return { ...after, replays: recording.start.phase === 0 ? { ...completed, [recording.side]: recording } : completed };
  }
  return { ...after, replays: { ...previous, current: recording } };
}
export function commitActivation(match: Match, activation: Activation, historical = false): Match { return recordTurn(match, { ...match, revision: match.revision + 1, game: activate(match.game, activation, historical, true), undo: [...match.undo, cloneGame(match.game)], savedAt: new Date().toISOString() }, activation); }
/** One atomic command: the semi-activation and the end of its turn. */
export function commitSemiActivation(match: Match, activation: Activation, historical = false): Match {
  requireRule(match.game.phase === 2 && match.game.stage === 'playing', 'Non è la fase di semiattivazione.');
  const next = commitActivation(match, activation, historical);
  return recordTurn(next, { ...next, game: endTurn(next.game, historical), undo: [] });
}
export function hasExtraStep(game: Game): boolean {
  return game.phase === 2 && game.wizards.some(w => w.side === game.active && w.pos && !game.activated.includes(w.id) && speed(game, w) > 0 && adjacent(w.pos).some(p => empty(game, p) && canEnter(game, p, w.side, w.id)));
}
export function finishesActivation(before: Game, after: Game): boolean { return Boolean(after.pending || before.turn === 0 || before.phase === 2 || after.phase === 2 && !hasExtraStep(after)); }
export function commitFinalActivation(match: Match, activation: Activation, historical = false): Match {
  const next = commitActivation(match, activation, historical);
  requireRule(finishesActivation(match.game, next.game), 'Questa attivazione non conclude il turno: restano azioni disponibili.');
  return recordTurn(next, { ...next, game: endTurn(next.game, historical), undo: [] });
}
export function commitSkip(match: Match, historical = false): Match { return recordTurn(match, { ...match, revision: match.revision + 1, game: skipPhase(match.game, historical), undo: [...match.undo, cloneGame(match.game)], savedAt: new Date().toISOString() }); }
export function commitFinalSkip(match: Match, historical = false): Match {
  const next = commitSkip(match, historical);
  requireRule(next.game.phase >= 3 || next.game.phase === 2 && !hasExtraStep(next.game), 'Restano fasi disponibili.');
  return recordTurn(next, { ...next, game: endTurn(next.game, historical), undo: [] });
}
export function finishTurn(match: Match, historical = false): Match { return recordTurn(match, { ...match, revision: match.revision + 1, game: endTurn(match.game, historical), undo: [], savedAt: new Date().toISOString() }); }
export function undoActivation(match: Match): Match {
  requireRule(match.game.stage !== 'finished' && match.undo.length > 0, 'Non puoi annullare oltre il tuo turno corrente.');
  const game = cloneGame(match.undo[match.undo.length - 1]), current = match.replays?.current;
  return { ...match, revision: match.revision + 1, game, undo: match.undo.slice(0, -1), savedAt: new Date().toISOString(), ...(current ? { replays: { ...match.replays, current: { ...current, end: replaySnapshot(game), entries: current.entries.filter(entry => entry.logLength <= game.log.length) } } } : {}) };
}
