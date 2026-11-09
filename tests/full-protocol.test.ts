import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type Peer from 'peerjs';
import { OnlineSession } from '../src/network/session';
import { append, makeSession, replay, fingerprint, type Command, type SessionRecord } from '../src/network/model';

vi.mock('peerjs', () => ({ default: class {} }));

class FakeConnection extends EventEmitter {
  open = false;
  partner!: FakeConnection;
  constructor(readonly network: FakeNetwork, readonly metadata: unknown) { super(); }
  send(message: Record<string, unknown>) {
    if (!this.open) throw new Error('Canale chiuso');
    if (message.type === this.network.drop) { this.network.drop = ''; this.close(); return; }
    const copy = structuredClone(message);
    queueMicrotask(() => { if (this.partner.open) this.partner.emit('data', copy); });
  }
  close() {
    if (!this.open && !this.partner.open) return;
    this.open = this.partner.open = false;
    queueMicrotask(() => { this.emit('close'); this.partner.emit('close'); });
  }
}
class FakePeer extends EventEmitter {
  destroyed = false;
  disconnected = false;
  connections: FakeConnection[] = [];
  constructor(readonly network: FakeNetwork, readonly id: string) {
    super(); network.peers.set(id, this);
    queueMicrotask(() => { if (!this.destroyed) this.emit('open', id); });
  }
  connect(id: string, options: { metadata: unknown }) {
    const target = this.network.peers.get(id);
    const local = new FakeConnection(this.network, options.metadata);
    const remote = new FakeConnection(this.network, options.metadata);
    local.partner = remote; remote.partner = local;
    this.connections.push(local);
    if (!target) { queueMicrotask(() => this.emit('error', { type: 'peer-unavailable' })); return local; }
    target.connections.push(remote);
    queueMicrotask(() => {
      target.emit('connection', remote);
      local.open = remote.open = true;
      local.emit('open'); remote.emit('open');
    });
    return local;
  }
  reconnect() { this.disconnected = false; queueMicrotask(() => this.emit('open', this.id)); }
  destroy() {
    this.destroyed = true; this.network.peers.delete(this.id);
    for (const connection of this.connections) connection.close();
  }
}
class FakeNetwork {
  peers = new Map<string, FakePeer>();
  drop = '';
  create = (id?: string) => new FakePeer(this, id ?? crypto.randomUUID()) as unknown as Peer;
}
const running: OnlineSession[] = [];
afterEach(() => { for (const session of running.splice(0)) session.dispose(); });

function pair(overrides?: { host?: SessionRecord; guest?: SessionRecord; failSave?: (record: SessionRecord) => boolean; beforeSave?: (record: SessionRecord) => Promise<void> }) {
  const network = new FakeNetwork();
  const hostRecord = overrides?.host ?? makeSession('Ada');
  const guestRecord = overrides?.guest ?? makeSession('Bruno', hostRecord);
  const saved = new Map<string, SessionRecord>();
  const save = async (record: SessionRecord) => {
    await overrides?.beforeSave?.(record);
    if (overrides?.failSave?.(record)) throw new Error('Spazio locale esaurito');
    saved.set(record.role, structuredClone(record));
  };
  const host = new OnlineSession(hostRecord, { createPeer: network.create, save });
  const guest = new OnlineSession(guestRecord, { createPeer: network.create, save });
  running.push(host, guest); host.start(); guest.start();
  return { network, host, guest, saved };
}
async function connected(host: OnlineSession, guest: OnlineSession) {
  await vi.waitFor(() => {
    expect(host.getSnapshot().phase).toBe('connected');
    expect(guest.getSnapshot().phase).toBe('connected');
  }, { timeout: 10000 });
}

async function ready(host: OnlineSession, guest: OnlineSession) {
  await connected(host, guest);
  host.displayed(host.getSnapshot().record.journal.events.length);
  guest.displayed(guest.getSnapshot().record.journal.events.length);
  await vi.waitFor(() => { expect(host.getSnapshot().ready).toBe(true); expect(guest.getSnapshot().ready).toBe(true); });
}
const move = (id = 'move', actor: 'red' | 'blue' = 'red'): Command => ({ id, actor, at: '2026-11-07T12:00:00.000Z', action: { kind: 'activate', activation: { wizardId: `${actor}:electromancer`, before: [{ x: actor === 'red' ? 1 : 8, y: actor === 'red' ? 8 : 1 }], after: [] } } });
async function done(host: OnlineSession, guest: OnlineSession, count: number) {
  await vi.waitFor(() => { expect(host.getSnapshot().record.journal.events).toHaveLength(count); expect(guest.getSnapshot().record.journal).toEqual(host.getSnapshot().record.journal); expect(host.getSnapshot().busy).toBe(false); expect(guest.getSnapshot().busy).toBe(false); });
}
describe('Gioco completo: protocollo persistente', () => {
  it('ignora i canali tardivi del peer precedente dopo la riconnessione', async () => {
    const { host, guest, network } = pair(); await ready(host, guest);
    const previous = network.peers.get(host.getSnapshot().record.hostPeerId)!;
    host.reconnect(); guest.reconnect(); await ready(host, guest);
    const remote = new FakeConnection(network, { roomId: host.getSnapshot().record.roomId, credential: guest.getSnapshot().record.credential });
    const local = new FakeConnection(network, remote.metadata); remote.partner = local; local.partner = remote;
    const close = vi.spyOn(remote, 'close'); previous.emit('connection', remote);
    expect(close).toHaveBeenCalled();
    expect(host.getSnapshot().ready).toBe(true); expect(guest.getSnapshot().ready).toBe(true);
  });
  it.each(['position', 'turn'])('l’invitato rifiuta un campo iniziale alterato dal creatore: %s', async field => {
    const record = makeSession('Ada');
    if (field === 'position') record.journal.initial!.game.wizards[0].pos = { x: 0, y: 1 };
    else record.journal.initial!.game.active = 'blue';
    const { host, guest } = pair({ host: record });
    await vi.waitFor(() => expect(guest.getSnapshot().phase).toBe('error'));
    expect(guest.getSnapshot().record.journal.initial).toBeNull();
    expect(host.getSnapshot().record.journal.events).toHaveLength(0);
  });
  it('una disconnessione remota durante la scrittura conserva il dato e riprende automaticamente', async () => {
    let entered!: () => void, release!: () => void, held = false;
    const saving = new Promise<void>(resolve => { entered = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const { host, guest } = pair({ beforeSave: async record => {
      if (record.role === 'guest' && record.prepared && !held) { held = true; entered(); await blocked; }
    } });
    await ready(host, guest);
    const request = host.request(move('remote-disconnect'));
    await saving;
    try { host.reconnect(); } finally { release(); }
    await request; await connected(host, guest); await done(host, guest, 1); await ready(host, guest);
    expect(guest.getSnapshot().record.prepared).toBeNull();
    expect(host.getSnapshot().record.journal.events[0].id).toBe('remote-disconnect');
  }, 15000);
  it.each(['host', 'guest'])('ricollega durante un salvataggio lento del %s e recupera una sola conferma', async role => {
    let entered!: () => void, release!: () => void, held = false;
    const saving = new Promise<void>(resolve => { entered = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const { host, guest } = pair({ beforeSave: async record => {
      if (record.role === role && record.prepared && !held) { held = true; entered(); await blocked; }
    } });
    await ready(host, guest);
    const errors: string[] = [];
    for (const session of [host, guest]) session.subscribe(() => { if (session.getSnapshot().phase === 'error') errors.push(session.getSnapshot().error); });
    const request = host.request(move('slow-save'));
    await saving;
    try { host.reconnect(); guest.reconnect(); } finally { release(); }
    await request; await connected(host, guest);
    await done(host, guest, 1); await ready(host, guest);
    expect(errors).toEqual([]);
    expect(host.getSnapshot().record.journal.events.filter(e => e.id === 'slow-save')).toHaveLength(1);
    expect(host.getSnapshot().record.outbox).toBeNull();
    expect(guest.getSnapshot().record.prepared).toBeNull();
  }, 15000);
  it('semiattivazione e cambio turno restano un solo comando anche se si interrompe la conferma', async () => {
    const { host, guest, network, saved } = pair(); await ready(host, guest);
    await host.request(move()); await done(host, guest, 1); await ready(host, guest);
    await host.request({ id: 'end-red', actor: 'red', at: move().at, action: { kind: 'end-turn' } }); await done(host, guest, 2); await ready(host, guest);
    await guest.request(move('blue-one', 'blue')); await done(host, guest, 3); await ready(host, guest);
    await guest.request({ id: 'blue-two', actor: 'blue', at: move().at, action: { kind: 'activate', activation: { wizardId: 'blue:geomancer', before: [{ x: 7, y: 1 }], after: [] } } }); await done(host, guest, 4); await ready(host, guest);
    network.drop = 'commit';
    void guest.request({ id: 'semi-auto', actor: 'blue', at: move().at, action: { kind: 'activate', completeTurn: true, activation: { wizardId: 'blue:illusionist', before: [{ x: 3, y: 1 }], after: [] } } });
    await vi.waitFor(() => expect(network.drop).toBe(''));
    host.dispose(); guest.dispose(); const resumed = pair({ host: structuredClone(saved.get('host')!), guest: structuredClone(saved.get('guest')!) }); await ready(resumed.host, resumed.guest); await done(resumed.host, resumed.guest, 5);
    const match = replay(resumed.guest.getSnapshot().record.journal); expect(match.game.turn).toBe(2); expect(match.game.active).toBe('red'); expect(match.undo).toHaveLength(0);
    expect(resumed.host.getSnapshot().record.journal.events.filter(e => e.id === 'semi-auto')).toHaveLength(1);
  });
  it.each(['prepare', 'prepared', 'commit', 'committed'])('recupera la stessa attivazione anche perdendo %s e riavviando entrambi', async drop => {
    const { network, host, guest, saved } = pair(); await ready(host, guest);
    network.drop = drop; void host.request(move('exactly-once'));
    await vi.waitFor(() => { expect(network.drop).toBe(''); expect(host.getSnapshot().phase).toBe('offline'); });
    const a = structuredClone(saved.get('host')!), b = structuredClone(saved.get('guest')!);
    expect(a.outbox || a.journal.events.some(e => e.id === 'exactly-once')).toBeTruthy();
    host.dispose(); guest.dispose();
    const resumed = pair({ host: a, guest: b });
    await connected(resumed.host, resumed.guest);
    resumed.host.displayed(resumed.host.getSnapshot().record.journal.events.length);
    resumed.guest.displayed(resumed.guest.getSnapshot().record.journal.events.length);
    await done(resumed.host, resumed.guest, 1);
    expect(resumed.host.getSnapshot().record.outbox).toBeNull(); expect(resumed.guest.getSnapshot().record.prepared).toBeNull();
    expect(replay(resumed.host.getSnapshot().record.journal).game.wizards.find(w => w.id === 'red:electromancer')!.pos).toEqual({ x: 1, y: 8 });
    expect(replay(resumed.host.getSnapshot().record.journal).savedAt).toBe('2026-11-07T12:00:00.000Z');
  });
  it.each(['request', 'prepare', 'prepared', 'commit', 'committed'])('recupera una richiesta Blu interrotta durante %s, senza duplicazioni', async drop => {
    const { network, host, guest, saved } = pair(); await ready(host, guest);
    await host.request(move()); await done(host, guest, 1); await ready(host, guest);
    await host.request({ id: 'end', actor: 'red', at: move().at, action: { kind: 'end-turn' } }); await done(host, guest, 2); await ready(host, guest);
    network.drop = drop; void guest.request(move('blue-pending', 'blue'));
    await vi.waitFor(() => expect(network.drop).toBe(''));
    host.dispose(); guest.dispose();
    const resumed = pair({ host: structuredClone(saved.get('host')!), guest: structuredClone(saved.get('guest')!) });
    await connected(resumed.host, resumed.guest);
    resumed.host.displayed(resumed.host.getSnapshot().record.journal.events.length); resumed.guest.displayed(resumed.guest.getSnapshot().record.journal.events.length);
    await done(resumed.host, resumed.guest, 3);
    expect(resumed.guest.getSnapshot().record.outbox).toBeNull();
    expect(resumed.host.getSnapshot().record.journal.events.filter(e => e.id === 'blue-pending')).toHaveLength(1);
  });
  it('attende la fine delle animazioni di entrambi, poi sincronizza annullamento e nuovo comando', async () => {
    const { host, guest } = pair(); await ready(host, guest);
    await host.request(move()); await done(host, guest, 1);
    expect(host.getSnapshot().ready).toBe(false);
    host.displayed(1); await new Promise(resolve => setTimeout(resolve, 20)); expect(host.getSnapshot().ready).toBe(false);
    guest.displayed(0); expect(guest.getSnapshot().ready).toBe(false);
    await ready(host, guest);
    await host.request({ id: 'undo', actor: 'red', at: move().at, action: { kind: 'undo' } }); await done(host, guest, 2);
    expect(replay(guest.getSnapshot().record.journal).game.wizards.find(w => w.id === 'red:electromancer')!.pos).toEqual({ x: 1, y: 9 });
    await ready(host, guest); await host.request(move('again')); await done(host, guest, 3);
    expect(fingerprint(host.getSnapshot().record.journal)).toBe(fingerprint(guest.getSnapshot().record.journal));
  });
  it.each(['host', 'guest'])('nessun commit se il browser %s non salva; conserva la richiesta recuperabile', async role => {
    const { host, guest } = pair({ failSave: record => record.role === role && Boolean(record.prepared) }); await ready(host, guest);
    void host.request(move());
    await vi.waitFor(() => expect((role === 'host' ? host : guest).getSnapshot().phase).toBe('error'));
    expect(host.getSnapshot().record.journal.events).toHaveLength(0); expect(guest.getSnapshot().record.journal.events).toHaveLength(0);
    expect(host.getSnapshot().record.outbox?.command.id).toBe('move');
  });
  it('rifiuta cronologie divergenti senza cancellare le prove', async () => {
    const a = makeSession('Ada'), b = makeSession('Bruno', a); b.journal = structuredClone(a.journal);
    a.journal = append(a.journal, move('a')); b.journal = append(b.journal, move('b'));
    const { host, guest } = pair({ host: a, guest: b });
    await vi.waitFor(() => expect(host.getSnapshot().phase).toBe('error'));
    expect(host.getSnapshot().record.journal).toEqual(a.journal); expect(guest.getSnapshot().record.journal).toEqual(b.journal);
  });
  it('un terzo invito non riassegna il posto Blu', async () => {
    const { host, guest, network } = pair(); await ready(host, guest); guest.pause();
    const stranger = new OnlineSession(makeSession('Intruso', host.getSnapshot().record), { createPeer: network.create, save: async () => {} }); running.push(stranger); stranger.start();
    await vi.waitFor(() => expect(stranger.getSnapshot().phase).toBe('error'));
    expect(stranger.getSnapshot().error).toContain('assegnato'); expect(host.getSnapshot().record.guestCredential).toBe(guest.getSnapshot().record.credential);
  });
  it('recupera una preparazione salvata dall’altro browser anche se il backup del creatore è più vecchio', async () => {
    const original = makeSession('Ada'), remote = makeSession('Bruno', original);
    remote.journal = structuredClone(original.journal);
    remote.prepared = append(remote.journal, move('survives-old-backup'));
    original.guestCredential = remote.credential;
    const { host, guest } = pair({ host: original, guest: remote }); await ready(host, guest); await done(host, guest, 1);
    expect(host.getSnapshot().record.journal.events[0].id).toBe('survives-old-backup');
    expect(host.getSnapshot().record.prepared).toBeNull(); expect(guest.getSnapshot().record.prepared).toBeNull();
  });
});
