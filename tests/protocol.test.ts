import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type Peer from 'peerjs';
import { OnlineSession } from '../src/online';
import { append, makeSession, type SessionRecord } from '../src/model';

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

function pair(overrides?: { host?: SessionRecord; guest?: SessionRecord; failSave?: (record: SessionRecord) => boolean }) {
  const network = new FakeNetwork();
  const hostRecord = overrides?.host ?? makeSession('Ada');
  const guestRecord = overrides?.guest ?? makeSession('Bruno', hostRecord);
  const saved = new Map<string, SessionRecord>();
  const save = async (record: SessionRecord) => {
    if (overrides?.failSave?.(record)) throw new Error('Spazio locale esaurito');
    saved.set(record.role, structuredClone(record));
  };
  const host = new OnlineSession(hostRecord, { createPeer: network.create, save });
  const guest = new OnlineSession(guestRecord, { createPeer: network.create, save });
  running.push(host, guest); host.start(); guest.start();
  return { network, host, guest, saved };
}
async function ready(host: OnlineSession, guest: OnlineSession) {
  await vi.waitFor(() => {
    expect(host.getSnapshot().phase).toBe('connected');
    expect(guest.getSnapshot().phase).toBe('connected');
  });
}
describe('Conferma persistente e recupero dopo interruzioni', () => {
  it.each([
    ['prepare', 0], ['prepared', 0], ['commit', 1], ['committed', 1]
  ])('interruzione durante %s: recupera la revisione %i senza duplicazioni', async (drop, expected) => {
    const { network, host, guest } = pair();
    await ready(host, guest);
    network.drop = drop;
    host.request({ id: 'move-after-drop', actor: 'red', kind: 'move', to: { x: 4, y: 5 } });
    await vi.waitFor(() => {
      expect(network.drop).toBe('');
      expect(host.getSnapshot().phase).toBe('offline');
      expect(guest.getSnapshot().phase).toBe('offline');
    });
    host.pause(); guest.pause(); host.reconnect(); guest.reconnect();
    await ready(host, guest);
    expect(host.getSnapshot().record.journal.events).toHaveLength(expected);
    expect(guest.getSnapshot().record.journal).toEqual(host.getSnapshot().record.journal);
    expect(host.getSnapshot().record.prepared).toBeNull();
    expect(guest.getSnapshot().record.prepared).toBeNull();
    if (expected === 0) {
      host.request({ id: 'retry', actor: 'red', kind: 'move', to: { x: 4, y: 5 } });
      await vi.waitFor(() => expect(guest.getSnapshot().record.journal.events).toHaveLength(1));
    }
  });
  it('non conferma se il browser ospite non riesce a salvare', async () => {
    const { host, guest } = pair({ failSave: record => record.role === 'guest' && Boolean(record.prepared) });
    await ready(host, guest);
    host.request({ id: 'no-storage', actor: 'red', kind: 'move', to: { x: 4, y: 5 } });
    await vi.waitFor(() => expect(guest.getSnapshot().phase).toBe('error'));
    expect(guest.getSnapshot().error).toContain('Spazio');
    expect(host.getSnapshot().record.journal.events).toHaveLength(0);
    expect(guest.getSnapshot().record.journal.events).toHaveLength(0);
  });
  it('blocca il recupero divergente senza sovrascrivere nessuno dei due salvataggi', async () => {
    const hostRecord = makeSession('Ada');
    const guestRecord = makeSession('Bruno', hostRecord);
    hostRecord.journal = append(hostRecord.journal, { id: 'a', actor: 'red', kind: 'move', to: { x: 4, y: 5 } });
    guestRecord.journal = append(guestRecord.journal, { id: 'b', actor: 'red', kind: 'move', to: { x: 3, y: 8 } });
    const { host, guest } = pair({ host: hostRecord, guest: guestRecord });
    await vi.waitFor(() => expect(host.getSnapshot().phase).toBe('error'));
    expect(host.getSnapshot().error).toContain('divergenti');
    expect(host.getSnapshot().record.journal).toEqual(hostRecord.journal);
    expect(guest.getSnapshot().record.journal).toEqual(guestRecord.journal);
  });
});
