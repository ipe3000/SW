import { GameMessageError, type MessageCode } from '../i18n/messages';
import { activate, analysisHistoryLimit, count, INFO, KINDS, other, SPELL_KIND, type ChronicleEvent, type Game, type Kind, type Match, type Options, type Result, type Side, type TurnReplay } from './game';
import { readGameAction } from './commands';
import { inside, key, type Point } from './geometry';
import { isComputerSpeed } from '../ai/speed';

function check(value: unknown, code: MessageCode): asserts value { if (!value) throw new GameMessageError(code); }
function obj(value: unknown): Record<string, unknown> { check(value && typeof value === 'object' && !Array.isArray(value), 'backupInvalidMatchData'); return value as Record<string, unknown>; }
function str(value: unknown, max = 100): string { check(typeof value === 'string' && value.length > 0 && value.length <= max, 'backupInvalidMatchText'); return value; }
function number(value: unknown, min: number, max: number): number { check(Number.isInteger(value) && (value as number) >= min && (value as number) <= max, 'backupInvalidMatchNumber'); return value as number; }
function side(value: unknown): Side { check(value === 'red' || value === 'blue', 'backupInvalidPlayerColor'); return value; }
function point(value: unknown): Point { const p = obj(value); const pos = { x: number(p.x, 0, 9), y: number(p.y, 0, 9) }; check(inside(pos), 'backupInvalidSquare'); return pos; }
function list(value: unknown, max: number): unknown[] { check(Array.isArray(value) && value.length <= max, 'backupTheMatchListIsInvalidOrTooLong'); return value; }
function readOptions(value: unknown): Options {
  const o = obj(value); check([3, 4, 5].includes(o.hp as number), 'backupInvalidStartingHealth');
  check(o.walls === 'standard' || o.walls === 'varied', 'backupInvalidWallVariant');
  check(o.placement === 'standard' || o.placement === 'custom', 'backupInvalidDeploymentVariant');
  return { hp: o.hp as Options['hp'], walls: o.walls, placement: o.placement, redName: str(o.redName, 40), blueName: str(o.blueName, 40) };
}
function readResult(value: unknown): Result | null {
  if (value == null) return null;
  const r = obj(value); const winner = side(r.winner), loser = side(r.loser);
  check(winner === other(loser), 'backupInvalidMatchResult');
  return { winner, loser, reason: str(r.reason, 500) };
}
function readChronicle(value: unknown, turn: number): ChronicleEvent[] {
  let previousTurn = 0;
  return list(value, 10000).map(item => {
    const event = obj(item), eventTurn = number(event.turn, previousTurn, turn);
    previousTurn = eventTurn;
    const action = readGameAction({ kind: 'activate', activation: event.activation });
    check(action.kind === 'activate', 'backupTheChronicleIsMissingAnActivation');
    const activation = action.activation;
    const [actorSide, actorKind] = activation.wizardId.split(':') as [Side, Kind];
    const charmedBy = event.charmedBy === undefined ? undefined : str(event.charmedBy);
    if (charmedBy) {
      check(!activation.spell && charmedBy === `${other(actorSide)}:enchanter`, 'backupTheCharmRecordedInTheChronicleIsInconsistent');
    } else {
      check(activation.spell?.kind === SPELL_KIND[actorKind], 'backupTheAbilityRecordedInTheChronicleIsInconsistent');
    }
    const effects = list(event.effects, 34).map<ChronicleEvent['effects'][number]>(value => {
      const effect = obj(value), kind = effect.kind, wizardId = str(effect.wizardId);
      check(kind === 'damage' || kind === 'removed' || kind === 'move' || kind === 'restrain' || kind === 'fade', 'backupInvalidChronicleEffect');
      check(KINDS.some(kind => wizardId === `red:${kind}` || wizardId === `blue:${kind}`), 'backupInvalidMageInTheChronicle');
      return { kind, wizardId };
    });
    check(!charmedBy || effects.length === 0, 'backupTheEffectsRecordedInTheChronicleAreInconsistent');
    return { turn: eventTurn, activation, ...(charmedBy ? { charmedBy } : {}), effects };
  });
}
export function readGame(value: unknown): Game {
  const v = obj(value); check(v.version === 1, 'backupIncompatibleRulesVersion');
  const options = readOptions(v.options), turn = number(v.turn, 0, 100000), phase = number(v.phase, 0, 3);
  check(v.stage === 'deployment' || v.stage === 'playing' || v.stage === 'finished', 'backupInvalidMatchPhase');
  const wizards = list(v.wizards, 16).map(value => {
    const w = obj(value), color = side(w.side);
    check(KINDS.includes(w.kind as never), 'backupUnknownMageClass');
    const kind = w.kind as keyof typeof INFO, id = str(w.id);
    check(id === `${color}:${kind}`, 'backupInvalidMageId');
    return { id, side: color, kind, hp: number(w.hp, 1, options.hp), pos: w.pos === null ? null : point(w.pos), ...(w.restrainedUntil === undefined ? {} : { restrainedUntil: number(w.restrainedUntil, turn, turn + 1) }) };
  });
  check(new Set(wizards.map(w => w.id)).size === wizards.length, 'backupTheSaveContainsDuplicateMages');
  const walls = list(v.walls, 4).map(point), dice = list(v.dice, 4).map(d => number(d, 1, 6));
  check(dice.length === (options.walls === 'standard' ? 2 : 4), 'backupInvalidSetupDice');
  const expectedWalls = options.walls === 'standard' ? dice.map((d, i) => ({ x: d + 1, y: 4 + i })) : dice.flatMap((d, i) => d > 4 ? [] : [{ x: 1 + 2 * i + (d - 1) % 2, y: 4 + Math.floor((d - 1) / 2) }]);
  check(JSON.stringify(walls) === JSON.stringify(expectedWalls), 'backupTheWallsDoNotMatchTheSetupDice');
  const copies = list(v.copies, 2).map(value => {
    const c = obj(value), ownerId = str(c.ownerId), color = side(c.side);
    check(wizards.some(w => w.id === ownerId && w.side === color && w.kind === 'illusionist'), 'backupTheCopyHasNoValidIllusionist');
    return { ownerId, side: color, pos: point(c.pos) };
  });
  check(new Set(copies.map(c => c.side)).size === copies.length, 'backupAGuildHasMoreThanOneCopy');
  const occupied = [...walls, ...wizards.flatMap(w => w.pos ? [w.pos] : []), ...copies.map(c => c.pos)].map(key);
  check(new Set(occupied).size === occupied.length, 'backupTwoPiecesOccupyTheSameSquareInThisSave');
  const active = side(v.active), deployment = obj(v.deployment);
  const activated = list(v.activated, 3).map(id => str(id));
  check(new Set(activated).size === activated.length && activated.every(id => KINDS.some(kind => id === `${active}:${kind}`)), 'backupInvalidActivationList');
  check(typeof v.activity === 'boolean', 'backupInvalidTurnState');
  const game: Game = { version: 1, id: str(v.id), options, walls, dice, wizards, copies, stage: v.stage, deployment: { step: number(deployment.step, 0, 5), count: number(deployment.count, 0, 6) }, active, turn, phase, activated, activity: v.activity, pending: readResult(v.pending), result: readResult(v.result), log: list(v.log, 10000).map(row => str(row, 2500)) };
  if (v.chronicle !== undefined) game.chronicle = readChronicle(v.chronicle, turn);
  if (game.stage === 'deployment') {
    check(game.options.placement === 'custom' && game.deployment.step < 5 && game.wizards.length === 16 && !game.copies.length && !game.pending && !game.result, 'backupInvalidDeployment');
    const quotas: [Side, number][] = [['red', 4], ['blue', 6], ['red', 2], ['blue', 2], ['red', 2]];
    check(game.active === quotas[game.deployment.step][0] && game.deployment.count < quotas[game.deployment.step][1], 'backupInvalidDeploymentSequence');
    const placed = { red: 0, blue: 0 };
    for (let i = 0; i < game.deployment.step; i++) placed[quotas[i][0]] += quotas[i][1];
    placed[game.active] += game.deployment.count;
    check((['red', 'blue'] as Side[]).every(s => game.wizards.filter(w => w.side === s && w.pos).length === placed[s]), 'backupInvalidNumberOfDeployedMages');
    check(game.wizards.every(w => !w.pos || w.pos.y === (w.side === 'red' ? 9 : 0) && w.pos.x >= 1 && w.pos.x <= 8), 'backupInvalidDeploymentSquare');
  } else {
    check(game.wizards.every(w => w.pos), 'backupSomeMagesHaveNotBeenDeployed');
    const ended = count(game, 'red') <= 3 || count(game, 'blue') <= 3;
    check(game.stage === 'finished' ? Boolean(game.result) && ended && !game.pending : !game.result && Boolean(game.pending) === ended, 'backupTheResultDoesNotMatchTheDefeatThreshold');
    const outcome = game.result ?? game.pending;
    if (outcome) {
      const both = count(game, 'red') <= 3 && count(game, 'blue') <= 3;
      check(outcome.loser === (both ? active : count(game, 'red') <= 3 ? 'red' : 'blue'), 'backupInconsistentMatchResult');
    }
  }
  return game;
}
export function readMatch(value: unknown): Match {
  const v = obj(value);
  check(v.format === 'strategic-wizardry-local' && (v.version === 1 || v.version === 2), 'backupThisFileIsNotACompatibleLocalMatchSave');
  const game = readGame(v.game), undo = list(v.undo, 8).map(readGame);
  check(undo.every(previous => previous.id === game.id && previous.turn === game.turn && previous.active === game.active && JSON.stringify(previous.options) === JSON.stringify(game.options) && JSON.stringify(previous.walls) === JSON.stringify(game.walls)), 'backupUndoHistoryDoesNotMatchTheCurrentTurn');
  check(typeof v.savedAt === 'string' && Number.isFinite(Date.parse(v.savedAt)), 'backupInvalidSaveDate');
  let computer: Match['computer'];
  if (v.computer !== undefined) {
    check(v.version === 2, 'backupTheOpponentRequiresSaveFormatVersion');
    const opponent = obj(v.computer);
    check(opponent.profile === 'didactic-v1', 'backupTheSavedOpponentIsIncompatibleUpdateTheGameBefor');
    check(opponent.speed === undefined || isComputerSpeed(opponent.speed), 'backupInvalidComputerSpeedInTheSave');
    const difficulty = opponent.difficulty === undefined ? undefined : obj(opponent.difficulty);
    const levels: NonNullable<Match['computer']>['difficulty'] = difficulty && {};
    if (difficulty && levels) for (const color of ['red', 'blue'] as const) {
      const level = difficulty[color];
      if (level === undefined) continue;
      check(level === 'easy' || level === 'normal' || level === 'hard', 'backupInvalidComputerDifficultyInTheSave');
      levels[color] = level;
    }
    computer = { ...(levels && { difficulty: levels }), profile: opponent.profile, side: opponent.side === 'both' ? 'both' : side(opponent.side), ...(opponent.speed === undefined ? {} : { speed: opponent.speed }) };
  }
  let replays: Match['replays'];
  if (v.replays !== undefined) {
    const stored = obj(v.replays); replays = {};
    for (const key of ['current', 'red', 'blue'] as const) if (stored[key] !== undefined) {
      const r = obj(stored[key]), start = readGame(r.start), end = readGame(r.end), turn = number(r.turn, 0, game.turn), color = side(r.side);
      check(start.id === game.id && end.id === game.id && start.turn === turn && start.active === color, 'backupTheReplayDoesNotMatchTheMatchState');
      const entries = list(r.entries, 3).map(item => {
        const e = obj(item), before = readGame(e.before), after = readGame(e.after), action = readGameAction({ kind: 'activate', activation: e.activation });
        check(action.kind === 'activate' && before.id === game.id && before.turn === turn && before.active === color && after.id === game.id && after.turn === turn && after.active === color, 'backupInvalidReplayActivation');
        const resolved = activate(before, action.activation, true);
        check(JSON.stringify({ ...readGame(resolved), log: [] }) === JSON.stringify({ ...after, log: [] }), 'backupTheReplayDoesNotMatchTheRecordedActions');
        return { before: { ...before, log: [] }, after: { ...after, log: [] }, activation: action.activation, logLength: number(e.logLength, 0, 10000) };
      });
      const recording: TurnReplay = { side: color, turn, start: { ...start, log: [] }, end: { ...end, log: [] }, entries };
      check(key === 'current' ? turn === game.turn && end.turn === turn && end.active === game.active : key === color && start.phase === 0 && (end.stage === 'finished' || end.turn === turn + 1 && end.active === other(color)), 'backupTheReplayTurnIsIncomplete');
      replays[key] = recording;
    }
  }
  const analysisHistory = v.analysisHistory === undefined ? undefined : list(v.analysisHistory, analysisHistoryLimit).map((item, index, entries) => {
    const entry = obj(item), before = readGame(entry.before);
    const action = readGameAction({ kind: 'activate', activation: entry.activation });
    const previous = index ? obj(obj(entries[index - 1]).before) : undefined;
    check(action.kind === 'activate' && before.id === game.id && before.stage === 'playing' && !before.pending &&
      before.turn <= game.turn && (!previous || before.turn > Number(previous.turn) || before.turn === previous.turn && before.phase > Number(previous.phase)) &&
      JSON.stringify(before.options) === JSON.stringify(game.options) && JSON.stringify(before.walls) === JSON.stringify(game.walls), 'backupInvalidReplayActivation');
    activate(before, action.activation, true);
    return { before: { ...before, log: [] }, activation: action.activation };
  });
  return { format: 'strategic-wizardry-local', version: v.version, revision: number(v.revision, 0, 100000), game, undo, savedAt: v.savedAt, ...(computer ? { computer } : {}), ...(replays ? { replays } : {}), ...(analysisHistory ? { analysisHistory } : {}) };
}
export function importMatch(text: string): Match {
  check(text.length <= 5_000_000, 'backupTheSaveExceedsTheMbLimit');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new GameMessageError('backupUnreadable'); }
  return readMatch(value);
}
