import { newMatch, defaultOptions, type Match, type Options, type Side } from '../engine/game';
import { readMatch } from '../engine/backup';
import { applyGameAction, readGameAction, type GameAction } from '../engine/commands';
import { cleanName, newId, readInvite, secret, seatFor, textField, type Invite, type Role } from '../model';
export { cleanName, newId, seatFor, textField };
export type Command = { id: string; actor: Side; at: string; action: GameAction };
export type Journal = { version: 1; roomId: string; initial: Match | null; events: Command[] };
export type SessionRecord = {
  version: 1; roomId: string; hostPeerId: string; joinToken: string; credential: string;
  role: Role; name: string; remoteName: string; guestCredential?: string;
  journal: Journal; prepared: Journal | null; outbox: { command: Command; base: string } | null;
  storageVersion: number; updatedAt: string;
};
const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
const object = (v: unknown): Record<string, unknown> => { check(v && typeof v === 'object' && !Array.isArray(v), 'Dati online non validi.'); return v as Record<string, unknown>; };
const date = (v: unknown) => { check(typeof v === 'string' && Number.isFinite(Date.parse(v)), 'Data non valida.'); return v as string; };
export function readCommand(value: unknown): Command {
  const v = object(value);
  check(v.actor === 'red' || v.actor === 'blue', 'Gilda non valida.');
  return { id: textField(v.id, 'Identificativo'), actor: v.actor as Side, at: date(v.at), action: readGameAction(v.action) };
}
const cache = new WeakMap<Journal, Match>();
export function replay(journal: Journal): Match {
  const cached = cache.get(journal); if (cached) return cached;
  check(journal.initial, 'In attesa del campo condiviso dal creatore.');
  let match = journal.initial!; const ids = new Set<string>();
  for (const event of journal.events) {
    check(!ids.has(event.id), 'Comando duplicato nella cronologia.'); ids.add(event.id);
    check(event.actor === match.game.active, 'È il turno dell’altra gilda.');
    match = { ...applyGameAction(match, event.action), savedAt: event.at };
  }
  cache.set(journal, match); return match;
}
export function append(journal: Journal, command: Command): Journal {
  check(journal.events.length < 10000, 'Limite della cronologia raggiunto. Esporta il backup.');
  const event = readCommand(command), next = { ...journal, events: [...journal.events, event] };
  replay(next); return next;
}
export const revision = (journal: Journal) => journal.events.length;
export function fingerprint(journal: Journal): string {
  let hash = 14695981039346656037n;
  for (const ch of JSON.stringify(journal)) hash = BigInt.asUintN(64, (hash ^ BigInt(ch.charCodeAt(0))) * 1099511628211n);
  return hash.toString(16).padStart(16, '0');
}
export function isPrefix(a: Journal, b: Journal): boolean {
  return a.roomId === b.roomId && (!a.initial && !a.events.length || JSON.stringify(a.initial) === JSON.stringify(b.initial)) && a.events.length <= b.events.length && a.events.every((e, i) => JSON.stringify(e) === JSON.stringify(b.events[i]));
}
export function reconcile(a: Journal, b: Journal): Journal {
  if (a.initial) replay(a); if (b.initial) replay(b);
  if (isPrefix(a, b)) return b;
  if (isPrefix(b, a)) return a;
  throw new Error('Cronologie divergenti: entrambi i salvataggi sono conservati. Esporta i backup prima di proseguire.');
}
export function readJournal(value: unknown, roomId?: string): Journal {
  const v = object(value), room = textField(v.roomId, 'Partita');
  check(v.version === 1 && (!roomId || room === roomId), 'Partita o versione online incompatibile.');
  check(Array.isArray(v.events) && v.events.length <= 10000, 'Cronologia non valida.');
  const initial = v.initial === null ? null : readMatch(v.initial);
  if (initial) check(initial.game.id === room && initial.revision === 0 && !initial.computer && !initial.undo.length && initial.game.turn === 0 && initial.game.phase === 0 && !initial.game.log.length && initial.game.wizards.length === 16 && initial.game.wizards.every(w => w.hp === initial.game.options.hp) && !initial.game.copies.length && !initial.game.pending && !initial.game.result && initial.game.deployment.step === 0 && initial.game.deployment.count === 0, 'Campo iniziale non valido.');
  const journal: Journal = { version: 1, roomId: room, initial, events: (v.events as unknown[]).map(readCommand) };
  check(initial || !journal.events.length, 'Manca il campo iniziale.');
  if (initial) replay(journal); return journal;
}
export function makeSession(name: string, invite?: Invite, options: Options = defaultOptions): SessionRecord {
  const roomId = invite?.roomId ?? newId();
  const initial = invite ? null : newMatch({ ...options, redName: cleanName(name), blueName: 'Gilda Blu' });
  if (initial) initial.game.id = roomId;
  return { version: 1, roomId, hostPeerId: invite?.hostPeerId ?? `sw-full-${newId()}`, joinToken: invite?.joinToken ?? secret(), credential: secret(), role: invite ? 'guest' : 'host', name: cleanName(name), remoteName: '', journal: readJournal({ version: 1, roomId, initial, events: [] }), prepared: null, outbox: null, storageVersion: 0, updatedAt: new Date().toISOString() };
}
export function readSession(value: unknown): SessionRecord {
  const v = object(value), invite = readInvite(v);
  check(v.role === 'host' || v.role === 'guest', 'Posto non valido.');
  const credential = textField(v.credential, 'Accesso', 48), guestCredential = v.guestCredential === undefined ? undefined : textField(v.guestCredential, 'Accesso Blu', 48);
  check(/^[a-f0-9]{48}$/.test(credential) && (!guestCredential || /^[a-f0-9]{48}$/.test(guestCredential)), 'Accesso personale non valido.');
  const journal = readJournal(v.journal, invite.roomId), prepared = v.prepared == null ? null : readJournal(v.prepared, invite.roomId);
  check(!prepared || isPrefix(journal, prepared) && revision(prepared) === revision(journal) + 1, 'Preparazione non coerente.');
  const pending = v.outbox == null ? null : object(v.outbox);
  const outbox = pending ? { command: readCommand(pending.command), base: textField(pending.base, 'Revisione', 16) } : null;
  check(!outbox || outbox.command.actor === seatFor(v.role as Role), 'La richiesta appartiene all’altra gilda.');
  check(Number.isSafeInteger(v.storageVersion) && (v.storageVersion as number) >= 0, 'Versione locale non valida.');
  return { ...invite, role: v.role as Role, credential, guestCredential, name: cleanName(textField(v.name, 'Nome', 40)), remoteName: typeof v.remoteName === 'string' ? v.remoteName.slice(0, 40) : '', journal, prepared, outbox, storageVersion: v.storageVersion as number, updatedAt: date(v.updatedAt) };
}
export function inviteUrl(record: SessionRecord): string {
  const invite: Invite = { version: 1, roomId: record.roomId, hostPeerId: record.hostPeerId, joinToken: record.joinToken };
  const url = new URL(location.href); url.search = '?online=1'; url.hash = `duello=${btoa(JSON.stringify(invite)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`; return url.href;
}
export function parseInvite(input: string): Invite {
  try {
    const url = new URL(input.trim(), location.href), encoded = new URLSearchParams(url.hash.slice(1)).get('duello');
    check(['http:', 'https:'].includes(url.protocol) && encoded && encoded.length <= 2000, 'Invito non valido.');
    return readInvite(JSON.parse(atob(encoded!.replace(/-/g, '+').replace(/_/g, '/'))));
  } catch { throw new Error('Invito non valido. Incolla il link completo del duello.'); }
}
export const backupText = (record: SessionRecord) => JSON.stringify({ format: 'strategic-wizardry-online', version: 1, session: record }, null, 2);
export function readBackup(text: string): SessionRecord {
  check(text.length < 8_000_000, 'Backup troppo grande (massimo 8 MB).');
  const v = object(JSON.parse(text)); check(v.format === 'strategic-wizardry-online' && v.version === 1, 'Backup online non compatibile.');
  return readSession(v.session);
}
