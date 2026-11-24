import { GameMessageError } from '../i18n/messages';
import { applyGameAction, type GameAction } from './commands';
import type { Game, Match, Side, TurnReplay } from './game';

export type MovePoint = {
  board: Omit<Game, 'version' | 'id' | 'options' | 'walls' | 'dice' | 'log'>;
  logLength: number;
  undo: number[];
  actor?: Side;
  manual?: true;
  completedTurn?: TurnReplay;
};

export function movePoint(game: Game): MovePoint {
  const { version, id, options, walls, dice, log, ...board } = game;
  return { board, logLength: log.length, undo: [] };
}

export function gameAt(live: Game, point: MovePoint): Game {
  const { version, id, options, walls, dice, log } = live;
  return { version, id, options, walls, dice, ...point.board, log: log.slice(0, point.logLength) };
}

// Placements have no log entry. An atomic activation and turn close can have two.
export function moveOrder(board: MovePoint['board'], logLength: number, custom: boolean): number {
  const placed = !custom ? 0 : board.stage !== 'deployment' ? 16 : board.wizards.filter(w => w.pos).length;
  return placed + logLength;
}

function order(game: Game) {
  return moveOrder(game, game.log.length, game.options.placement === 'custom');
}

function undoIndices(game: Game, points: MovePoint[], undo: Game[]) {
  return undo.flatMap(previous => {
    const target = order(previous), custom = game.options.placement === 'custom';
    for (let index = points.length - 1; index >= 0; index--) {
      const point = points[index];
      const position = moveOrder(point.board, point.logLength, custom);
      if (position === target) return [index];
      if (position < target) break;
    }
    return [];
  });
}

/** Older saves offer only positions actually retained in the undo stack and turn recordings. */
export function availableMoves(match: Match): MovePoint[] {
  if (match.moveHistory) return match.moveHistory;
  const { game } = match;
  const points = new Map<number, MovePoint>();
  function add(board: Game, logLength: number, completedTurn?: TurnReplay) {
    const point = { ...movePoint(board), logLength, ...(completedTurn && { completedTurn }) };
    const position = moveOrder(board, logLength, game.options.placement === 'custom');
    const previous = points.get(position);
    points.set(position, { ...previous, ...point, completedTurn: completedTurn ?? previous?.completedTurn });
  }
  const turnStarts = game.log.flatMap((line, index) => /^Inizia il turno (Rosso|Blu)\.$/.test(line) ? [index + 1] : []);
  const firstLoggedTurn = game.turn + 1 - turnStarts.length;
  const startLine = (turn: number) => turn === 0 ? 0 : turnStarts[turn - firstLoggedTurn];
  for (const recording of Object.values(match.replays ?? {})) {
    const { start, entries, end, turn } = recording;
    const finished = end.stage === 'finished';
    const closed = finished || end.turn !== turn;
    const endLine = closed && !finished ? startLine(end.turn) : game.log.length;
    const startAt = startLine(turn);
    if (startAt !== undefined && start.phase === 0) add(start, startAt);
    for (const entry of entries) {
      if (entry.logLength < 1 || entry.logLength > game.log.length) continue;
      add(entry.before, entry.logLength - 1);
      if (!closed || endLine === undefined || entry.logLength !== endLine - 1) add(entry.after, entry.logLength);
    }
    if (endLine !== undefined) add(end, endLine, closed ? recording : undefined);
  }
  for (const previous of match.undo) add(previous, previous.log.length);
  add(game, game.log.length);
  const available = [...points.entries()].sort(([a], [b]) => a - b).map(([, point]) => point);
  const knownUndo = undoIndices(game, available, match.undo);
  for (let i = 0; i < available.length; i++) {
    const point = available[i], previous = available[i - 1];
    point.undo = knownUndo.filter(index => index < i);
    if (!previous) continue;
    const difference = moveOrder(point.board, point.logLength, game.options.placement === 'custom') -
      moveOrder(previous.board, previous.logLength, game.options.placement === 'custom');
    if (difference === 1 || difference === 2 && (point.completedTurn?.entries.some(entry => entry.logLength === point.logLength - 1 && entry.logLength === previous.logLength + 1) ||
      game.log[previous.logLength]?.includes(' passata.') && point.board.turn === previous.board.turn + 1)) point.actor = previous.board.active;
  }
  return available;
}

export function recordMove(before: Match, next: Match, manual = false): Match {
  if (!before.computer || before.game === next.game) return next;
  const points = availableMoves(before);
  if (order(next.game) < order(before.game)) {
    const index = undoIndices(before.game, points, [next.game])[0];
    return { ...next, moveHistory: index === undefined ? availableMoves({ ...next, moveHistory: undefined }) : points.slice(0, index + 1) };
  }
  const actor = before.game.active;
  const oldRecording = before.replays?.[actor], recording = next.replays?.[actor];
  const completedTurn = recording !== oldRecording ? recording : undefined;
  const point: MovePoint = {
    ...movePoint(next.game), actor, undo: undoIndices(next.game, points, next.undo),
    ...(manual && { manual: true }), ...(completedTurn && { completedTurn }),
  };
  return { ...next, moveHistory: [...points, point] };
}

export function lastHumanMove(points: MovePoint[], human: Side): number | undefined {
  for (let i = points.length - 1; i > 0; i--) {
    if (!points[i].actor) return undefined;
    if (points[i].actor === human) return i - 1;
  }
}

export function canReplaceMove(match: Match, points: MovePoint[], index: number): boolean {
  const point = points[index];
  const computer = match.computer?.side;
  return Boolean(point && point.board.stage !== 'finished' && (computer === 'both' ||
    computer && computer !== point.board.active && index < points.length - 1));
}

function restoreMatch(match: Match, points: MovePoint[], index: number): Match {
  if (index === points.length - 1) return match;
  const point = points[index], game = gameAt(match.game, point);
  const replays: NonNullable<Match['replays']> = {};
  for (const { completedTurn } of points.slice(0, index + 1)) if (completedTurn) replays[completedTurn.side] = completedTurn;
  if (game.stage === 'playing') {
    const recording = points.slice(index + 1).find(entry => entry.completedTurn?.turn === game.turn)?.completedTurn ??
      Object.values(match.replays ?? {}).find(entry => entry.turn === game.turn && entry.side === game.active);
    if (recording && recording.start.phase < game.phase) {
      replays.current = { ...recording, end: { ...game, log: [] }, entries: recording.entries.filter(entry => entry.logLength <= point.logLength) };
    }
  }
  return {
    ...match, game, replays, undo: point.undo.map(i => gameAt(match.game, points[i])),
    recap: match.recap?.filter(entry => entry.logLength <= point.logLength),
    moveHistory: points.slice(0, index + 1),
  };
}

export function replaceMove(match: Match, index: number, action: GameAction): Match {
  const points = availableMoves(match);
  if (action.kind === 'undo' || !canReplaceMove(match, points, index)) throw new GameMessageError('historyMoveUnavailable');
  const base = restoreMatch(match, points, index);
  const { awaitingResume, ...next } = recordMove(base, applyGameAction(base, action), match.computer?.side === 'both');
  return next.game.stage === 'finished' ? next : { ...next, awaitingResume: true };
}
