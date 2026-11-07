import { commitActivation, commitSkip, finishTurn, placeWizard, undoActivation, type Activation, type Match, type Point, type Spell } from './game';

/** The same commands are used by the local UI and the online journal. */
export type GameAction = { kind: 'activate'; activation: Activation } | { kind: 'place'; wizardId: string; to: Point } | { kind: 'undo' | 'skip' | 'end-turn' };
export function applyGameAction(match: Match, action: GameAction): Match {
  switch (action.kind) {
    case 'activate': return commitActivation(match, action.activation);
    case 'skip': return commitSkip(match);
    case 'undo': return undoActivation(match);
    case 'end-turn': return finishTurn(match);
    case 'place': {
      const game = placeWizard(match.game, action.wizardId, action.to);
      return { ...match, game, revision: match.revision + 1, savedAt: new Date().toISOString(), undo: game.stage === 'deployment' && game.deployment.step === match.game.deployment.step ? [...match.undo, match.game] : [] };
    }
  }
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Comando non valido.');
  return v as Record<string, unknown>;
}
function id(v: unknown): string {
  if (typeof v !== 'string' || !/^(red|blue):(aeromancer|electromancer|enchanter|geomancer|illusionist|pyromancer|spellsword|teleporter)$/.test(v)) throw new Error('Mago non valido.');
  return v;
}
function point(v: unknown): Point {
  const p = object(v);
  if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || (p.x as number) < 0 || (p.x as number) > 9 || (p.y as number) < 0 || (p.y as number) > 9) throw new Error('Casella non valida.');
  return { x: p.x as number, y: p.y as number };
}
function path(v: unknown): Point[] {
  if (!Array.isArray(v) || v.length > 4) throw new Error('Percorso non valido.');
  return v.map(point);
}
function spell(v: unknown): Spell {
  const s = object(v);
  switch (s.kind) {
    case 'lightning': return { kind: s.kind };
    case 'touch': case 'earth': case 'sword': return { kind: s.kind, targetId: id(s.targetId) };
    case 'wind': return { kind: s.kind, targetId: id(s.targetId), path: path(s.path) };
    case 'fireball': return { kind: s.kind, center: point(s.center) };
    case 'teleport': return { kind: s.kind, targetId: id(s.targetId), destination: point(s.destination) };
    case 'illusion': return { kind: s.kind, ...(s.summon === undefined ? {} : { summon: point(s.summon) }), path: path(s.path), ...(s.targetId === undefined ? {} : { targetId: id(s.targetId) }) };
    default: throw new Error('Abilità non riconosciuta.');
  }
}
export function readGameAction(v: unknown): GameAction {
  const a = object(v);
  if (a.kind === 'skip' || a.kind === 'undo' || a.kind === 'end-turn') return { kind: a.kind };
  if (a.kind === 'place') return { kind: a.kind, wizardId: id(a.wizardId), to: point(a.to) };
  if (a.kind !== 'activate') throw new Error('Comando non riconosciuto.');
  const d = object(a.activation);
  return { kind: a.kind, activation: { wizardId: id(d.wizardId), before: path(d.before), ...(d.spell === undefined ? {} : { spell: spell(d.spell) }), after: path(d.after) } };
}
