export type Seat = 'red' | 'blue';
export type Role = 'host' | 'guest';
export type Point = { x: number; y: number };
export type Command = { id: string; actor: Seat; kind: 'move'; to: Point } | { id: string; actor: Seat; kind: 'undo' | 'end-turn' };
export type Journal = { version: 1; roomId: string; events: Command[] };
export type BoardState = { positions: Record<Seat, Point>; active: Seat; turn: number; moves: number; undo: Point[] };
export type SessionRecord = {
  version: 1; roomId: string; hostPeerId: string; joinToken: string; credential: string;
  role: Role; name: string; remoteName: string; guestCredential?: string;
  journal: Journal; prepared: Journal | null; updatedAt: string;
};
export type Invite = { version: 1; roomId: string; hostPeerId: string; joinToken: string };
export const MAX_EVENTS = 4096;
export const WALLS: Point[] = [{ x: 3, y: 4 }, { x: 6, y: 5 }];
export const seatFor = (role: Role): Seat => role === 'host' ? 'red' : 'blue';
export const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const squareName = (p: Point) => `${String.fromCharCode(65 + p.x)}${10 - p.y}`;
export const newId = () => crypto.randomUUID();
export function secret() { return Array.from(crypto.getRandomValues(new Uint8Array(24)), x => x.toString(16).padStart(2, '0')).join(''); }
export function cleanName(name: string) { return name.trim().slice(0, 40) || 'Giocatore'; }
export function initialState(): BoardState {
  return { positions: { red: { x: 4, y: 8 }, blue: { x: 5, y: 1 } }, active: 'red', turn: 1, moves: 0, undo: [] };
}
export function movementPath(state: BoardState, to: Point): Point[] | null {
  if (!Number.isInteger(to.x) || !Number.isInteger(to.y) || to.x < 0 || to.x > 9 || to.y < 0 || to.y > 9) return null;
  const from = state.positions[state.active];
  if (samePoint(from, to)) return null;
  const other = state.positions[state.active === 'red' ? 'blue' : 'red'];
  const queue: Point[][] = [[from]];
  const seen = new Set([`${from.x},${from.y}`]);
  while (queue.length) {
    const path = queue.shift()!;
    if (path.length > 3) continue;
    const p = path[path.length - 1];
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const next = { x: p.x + dx, y: p.y + dy };
      const key = `${next.x},${next.y}`;
      if (next.x < 0 || next.x > 9 || next.y < 0 || next.y > 9 || seen.has(key) || samePoint(next, other) || WALLS.some(w => samePoint(w, next))) continue;
      const candidate = [...path, next];
      if (samePoint(next, to)) return candidate;
      seen.add(key); queue.push(candidate);
    }
  }
  return null;
}
export function applyCommand(state: BoardState, command: Command): BoardState {
  if (command.actor !== state.active) throw new Error('È il turno dell’altro giocatore.');
  if (command.kind === 'move') {
    if (state.moves >= 2) throw new Error('Hai già confermato due spostamenti: annulla oppure termina il turno.');
    if (!movementPath(state, command.to)) throw new Error('Scegli una casella libera raggiungibile in tre passi.');
    return { ...state, positions: { ...state.positions, [state.active]: { ...command.to } }, moves: state.moves + 1, undo: [...state.undo, state.positions[state.active]] };
  }
  if (command.kind === 'undo') {
    if (!state.undo.length) throw new Error('Non ci sono spostamenti da annullare in questo turno.');
    return { ...state, positions: { ...state.positions, [state.active]: state.undo[state.undo.length - 1] }, moves: state.moves - 1, undo: state.undo.slice(0, -1) };
  }
  if (!state.moves) throw new Error('Conferma almeno uno spostamento prima di terminare il turno.');
  return { ...state, active: state.active === 'red' ? 'blue' : 'red', turn: state.turn + 1, moves: 0, undo: [] };
}
export function replay(journal: Journal): BoardState {
  let state = initialState(); const ids = new Set<string>();
  if (journal.events.length > MAX_EVENTS) throw new Error('Il laboratorio ha raggiunto il limite della cronologia. Esporta il backup e crea una nuova sessione.');
  for (const command of journal.events) {
    if (ids.has(command.id)) throw new Error('La cronologia contiene un comando duplicato.');
    ids.add(command.id); state = applyCommand(state, command);
  }
  return state;
}
export function append(journal: Journal, command: Command): Journal {
  const next = { ...journal, events: [...journal.events, readCommand(command)] }; replay(next); return next;
}
export const revision = (journal: Journal) => journal.events.length;
export function fingerprint(journal: Journal): string {
  let hash = 14695981039346656037n;
  for (const ch of JSON.stringify(journal)) hash = BigInt.asUintN(64, (hash ^ BigInt(ch.charCodeAt(0))) * 1099511628211n);
  return hash.toString(16).padStart(16, '0');
}
export function isPrefix(a: Journal, b: Journal): boolean {
  return a.version === b.version && a.roomId === b.roomId && a.events.length <= b.events.length && a.events.every((event, i) => JSON.stringify(event) === JSON.stringify(b.events[i]));
}
export function reconcile(a: Journal, b: Journal): Journal {
  replay(a); replay(b);
  if (isPrefix(a, b)) return b;
  if (isPrefix(b, a)) return a;
  throw new Error('I salvataggi contengono cronologie divergenti. Esporta entrambi i backup: la sessione resta ferma per evitare di sovrascriverli.');
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dati non validi.');
  return value as Record<string, unknown>;
}
export function textField(value: unknown, label: string, max = 100): string {
  if (typeof value !== 'string' || !value.length || value.length > max) throw new Error(`${label} non valido.`);
  return value;
}
export function readCommand(value: unknown): Command {
  const v = object(value); const id = textField(v.id, 'Identificativo');
  if (v.actor !== 'red' && v.actor !== 'blue') throw new Error('Giocatore non valido.');
  if (v.kind === 'undo' || v.kind === 'end-turn') return { id, actor: v.actor, kind: v.kind };
  if (v.kind !== 'move') throw new Error('Comando non riconosciuto.');
  const p = object(v.to);
  if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || (p.x as number) < 0 || (p.x as number) > 9 || (p.y as number) < 0 || (p.y as number) > 9) throw new Error('Casella non valida.');
  return { id, actor: v.actor, kind: 'move', to: { x: p.x as number, y: p.y as number } };
}
export function readJournal(value: unknown, roomId?: string): Journal {
  const v = object(value);
  if (v.version !== 1) throw new Error('Versione della prova non compatibile.');
  const room = textField(v.roomId, 'Sessione');
  if (roomId && room !== roomId) throw new Error('Il salvataggio appartiene a un’altra sessione.');
  if (!Array.isArray(v.events) || v.events.length > MAX_EVENTS) throw new Error('Cronologia non valida o troppo lunga.');
  const journal: Journal = { version: 1, roomId: room, events: v.events.map(readCommand) };
  replay(journal); return journal;
}
export function readInvite(value: unknown): Invite {
  const v = object(value);
  if (v.version !== 1) throw new Error('Invito non compatibile con questa versione.');
  const roomId = textField(v.roomId, 'Sessione');
  const hostPeerId = textField(v.hostPeerId, 'Indirizzo del creatore', 80);
  const joinToken = textField(v.joinToken, 'Codice d’invito', 48);
  if (!/^[a-zA-Z0-9_-]+$/.test(hostPeerId) || !/^[a-f0-9]{48}$/.test(joinToken)) throw new Error('Invito non valido.');
  return { version: 1, roomId, hostPeerId, joinToken };
}
export function inviteUrl(record: SessionRecord): string {
  const invite: Invite = { version: 1, roomId: record.roomId, hostPeerId: record.hostPeerId, joinToken: record.joinToken };
  const url = new URL(location.href); url.hash = `invito=${btoa(JSON.stringify(invite)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`; return url.href;
}
export function parseInvite(input: string): Invite {
  try {
    const url = new URL(input.trim(), location.href);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    const encoded = new URLSearchParams(url.hash.slice(1)).get('invito');
    if (!encoded || encoded.length > 2000) throw new Error();
    return readInvite(JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))));
  } catch { throw new Error('L’invito non è valido. Incolla il collegamento completo ricevuto dal creatore.'); }
}
export function makeSession(name: string, invite?: Invite): SessionRecord {
  const roomId = invite?.roomId ?? newId();
  return { version: 1, roomId, hostPeerId: invite?.hostPeerId ?? `sw-${newId()}`, joinToken: invite?.joinToken ?? secret(), credential: secret(), role: invite ? 'guest' : 'host', name: cleanName(name), remoteName: '', journal: { version: 1, roomId, events: [] }, prepared: null, updatedAt: new Date().toISOString() };
}
export function readSession(value: unknown): SessionRecord {
  const v = object(value); const invite = readInvite(v);
  if (v.role !== 'host' && v.role !== 'guest') throw new Error('Posto del giocatore non valido.');
  const credential = textField(v.credential, 'Accesso personale', 48);
  if (!/^[a-f0-9]{48}$/.test(credential)) throw new Error('Accesso personale non valido.');
  const guestCredential = v.guestCredential === undefined ? undefined : textField(v.guestCredential, 'Accesso dell’avversario', 48);
  if (guestCredential && !/^[a-f0-9]{48}$/.test(guestCredential)) throw new Error('Accesso dell’avversario non valido.');
  const journal = readJournal(v.journal, invite.roomId);
  const prepared = v.prepared == null ? null : readJournal(v.prepared, invite.roomId);
  if (prepared && (!isPrefix(journal, prepared) || prepared.events.length !== journal.events.length + 1)) throw new Error('Operazione in attesa non coerente.');
  return { ...invite, credential, role: v.role, name: cleanName(textField(v.name, 'Nome', 40)), remoteName: typeof v.remoteName === 'string' ? v.remoteName.slice(0, 40) : '', guestCredential, journal, prepared, updatedAt: typeof v.updatedAt === 'string' && Number.isFinite(Date.parse(v.updatedAt)) ? v.updatedAt : new Date().toISOString() };
}
export function backupText(record: SessionRecord): string { return JSON.stringify({ format: 'strategic-wizardry-lab', version: 1, session: record }, null, 2); }
export function readBackup(text: string): SessionRecord {
  if (text.length > 2_000_000) throw new Error('Il file supera il limite di 2 MB della prova.');
  let value: Record<string, unknown>;
  try { value = object(JSON.parse(text)); } catch { throw new Error('Il file non contiene un backup leggibile.'); }
  if (value.format !== 'strategic-wizardry-lab' || value.version !== 1) throw new Error('Formato o versione del backup non compatibili.');
  return readSession(value.session);
}
