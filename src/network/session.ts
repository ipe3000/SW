import Peer, { type DataConnection } from 'peerjs';
import { append, cleanName, fingerprint, isPrefix, readCommand, readJournal, reconcile, reconcileOutbox, replay, revision, seatFor, textField, type Command, type Journal, type SessionRecord } from './model';
import { saveSession } from './storage';

export type Phase = 'opening' | 'waiting' | 'connecting' | 'syncing' | 'connected' | 'offline' | 'paused' | 'error';
export type ConnectionView = { ready: boolean; waitingForPlayback: boolean; record: SessionRecord; phase: Phase; busy: boolean; error: string; message: string; savedAt: string; localSignaling: boolean };
type Wire = Record<string, unknown> & { type: string; version: number };
type Options = { createPeer?: (id?: string) => Peer; save?: (record: SessionRecord) => Promise<void> };
export class OnlineSession {
  private record: SessionRecord;
  private phase: Phase = 'opening';
  private busy = false;
  private error = '';
  private message = 'Apertura del collegamento…';
  private listeners = new Set<() => void>();
  private view: ConnectionView;
  private peer?: Peer;
  private connection?: DataConnection;
  private queue = Promise.resolve();
  private generation = 0;
  private stopped = false;
  private paused = false;
  private authenticated = false;
  private syncDigest = '';
  private localDisplayed = '';
  private remoteDisplayed = '';
  private sentDisplayed = '';
  private flushing = false;
  private recovered = false;
  private timer?: ReturnType<typeof setTimeout>;
  private watchdog?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private lastSeen = Date.now();
  private readonly save: (record: SessionRecord) => Promise<void>;
  private readonly createPeer: (id?: string) => Peer;
  readonly localSignaling = Boolean(import.meta.env.VITE_PEER_HOST);

  constructor(record: SessionRecord, options: Options = {}) {
    this.record = record;
    this.save = options.save ?? saveSession;
    this.createPeer = options.createPeer ?? ((id?: string) => {
      const config = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } };
      const testHost = import.meta.env.VITE_PEER_HOST;
      const settings = testHost ? { ...config, host: testHost, port: Number(import.meta.env.VITE_PEER_PORT ?? 9001), path: import.meta.env.VITE_PEER_PATH ?? '/wizardry', secure: import.meta.env.VITE_PEER_SECURE === 'true' } : config;
      return id ? new Peer(id, settings) : new Peer(settings);
    });
    this.view = this.makeView();
  }
  private makeView(): ConnectionView { return { ready: this.canPlay(), waitingForPlayback: this.phase === 'connected' && !this.busy && !this.displaysAgree(), record: this.record, phase: this.phase, busy: this.busy, error: this.error, message: this.message, savedAt: this.record.updatedAt, localSignaling: this.localSignaling }; }
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.view = this.makeView(); for (const listener of this.listeners) listener(); }
  private async persist(record: SessionRecord) {
    const generation = this.generation;
    const next = { ...record, updatedAt: new Date().toISOString(), storageVersion: this.record.storageVersion + 1 };
    await this.save(next);
    // A completed write stays authoritative even if the channel changed while saving.
    if (!this.stopped) { this.record = next; this.publish(); }
    if (this.stopped || this.paused || generation !== this.generation) throw new Error('Operazione del collegamento precedente interrotta.');
  }
  private enqueue(task: () => Promise<void> | void) {
    const generation = this.generation;
    return this.queue = this.queue.then(async () => { if (!this.stopped && !this.paused && generation === this.generation) await task(); }).catch(error => {
      if (this.stopped || this.paused || generation !== this.generation) return;
      this.error = error instanceof Error ? error.message : 'Operazione non riuscita.';
      this.phase = 'error'; this.busy = false; this.publish();
      this.connection?.close();
    });
  }
  start = () => {
    if (this.stopped) return;
    this.paused = false; this.error = ''; this.busy = false;
    this.phase = 'opening'; this.message = 'Apertura del collegamento…'; this.publish();
    const generation = this.generation;
    void this.queue.then(() => { if (!this.stopped && !this.paused && generation === this.generation) this.openPeer(); });
  };
  private openPeer() {
    if (this.stopped || this.paused || this.peer && !this.peer.destroyed) return;
    try {
      const peer = this.createPeer(this.record.role === 'host' ? this.record.hostPeerId : undefined);
      this.peer = peer;
      this.setWatchdog('Il servizio di collegamento non risponde. Controlla la connessione e premi «Ricollega».');
      peer.on('open', () => {
        if (this.stopped || this.paused || this.peer !== peer) return;
        this.clearWatchdog();
        if (this.connection?.open && this.authenticated) {
          this.phase = 'connected'; this.message = 'Collegamento fra giocatori attivo; servizio inviti ripristinato.'; this.publish(); return;
        }
        if (this.record.role === 'host') {
          this.phase = 'waiting'; this.message = 'Invito pronto. In attesa dell’altro giocatore.'; this.publish();
        } else this.connectGuest();
      });
      peer.on('connection', connection => {
        if (this.record.role !== 'host' || this.paused || this.stopped || this.peer !== peer) { connection.close(); return; }
        const metadata = connection.metadata as { roomId?: unknown; credential?: unknown } | undefined;
        if (this.record.guestCredential && metadata?.credential !== this.record.guestCredential) {
          const reject = () => connection.send({ type: 'reject', version: 2, reason: 'Il posto Blu è già assegnato. Per riprenderlo usa il suo salvataggio o importa il suo backup.' });
          connection.on('open', reject);
          if (connection.open) reject();
          setTimeout(() => { if (connection.open) connection.close(); }, 2000);
          return;
        }
        if (this.connection?.open && !this.busy && metadata?.roomId === this.record.roomId && metadata.credential === this.record.guestCredential) {
          const old = this.connection; this.connection = undefined; old.close();
        }
        this.attach(connection);
      });
      peer.on('disconnected', () => {
        if (this.stopped || this.paused || this.peer !== peer) return;
        if (this.connection?.open && this.authenticated) {
          this.message = 'Collegamento fra giocatori attivo; servizio inviti temporaneamente non disponibile.'; this.publish();
        } else this.markOffline('Servizio di collegamento interrotto. Attendo il ripristino.');
        this.scheduleRetry();
      });
      peer.on('error', error => {
        if (this.stopped || this.paused || this.peer !== peer) return;
        const type = error.type;
        if (this.connection?.open && this.authenticated && ['network', 'socket-error', 'socket-closed'].includes(type)) {
          this.message = 'La sessione è collegata; il servizio inviti non risponde.'; this.publish(); return;
        }
        this.clearWatchdog();
        if (type === 'unavailable-id') {
          this.phase = 'error'; this.error = 'Questa sessione è già aperta in un’altra finestra. Chiudila e premi «Ricollega».';
          this.publish(); return;
        }
        if (['browser-incompatible', 'invalid-id', 'invalid-key', 'ssl-unavailable'].includes(type)) {
          this.phase = 'error'; this.error = 'Questo browser o questa configurazione non permette il collegamento WebRTC.'; this.publish(); return;
        }
        this.markOffline(type === 'peer-unavailable' ? 'Il creatore non è ancora collegato. La sessione resta in attesa.' : 'Collegamento non disponibile. Le modifiche registrate restano salvate; la sessione attende il rientro.');
        this.scheduleRetry();
      });
    } catch (error) {
      this.phase = 'error'; this.error = error instanceof Error ? error.message : 'WebRTC non disponibile.'; this.publish();
    }
  }
  private connectGuest() {
    if (this.stopped || this.paused || !this.peer || this.peer.destroyed || this.peer.disconnected || this.connection?.open) return;
    this.phase = 'connecting'; this.message = 'Cerco il creatore della sessione…'; this.publish();
    // PeerJS JSON transport rejects messages >= 16.3 KB. Binary transport
    // fragments/reassembles them, so a full mid-game journal can be recovered.
    const connection = this.peer.connect(this.record.hostPeerId, { reliable: true, serialization: 'binary', label: 'strategic-wizardry-full-v2', metadata: { roomId: this.record.roomId, credential: this.record.credential } });
    this.attach(connection);
    this.setWatchdog('I browser non riescono a collegarsi. Alcune reti richiedono un relay TURN, non incluso in questa prova. Puoi riprovare da un’altra rete.');
  }
  private attach(connection: DataConnection) {
    // Reject unsolicited parallel channels. A closed channel may be replaced on rejoin.
    if (this.connection?.open && this.connection !== connection) { connection.close(); return; }
    this.generation++;
    this.connection = connection; this.authenticated = false; this.remoteDisplayed = ''; this.sentDisplayed = '';
    connection.on('open', () => {
      if (this.connection !== connection || this.stopped || this.paused) { connection.close(); return; }
      void this.enqueue(() => {
        if (this.connection !== connection || !connection.open) return;
        this.clearWatchdog(); this.phase = 'syncing'; this.busy = true; this.message = 'Verifico e sincronizzo i salvataggi…'; this.publish();
        this.setWatchdog('La sincronizzazione non è terminata. I salvataggi sono conservati: premi «Ricollega» per riprovare.');
        if (this.record.role === 'guest') this.send({ type: 'hello', roomId: this.record.roomId, token: this.record.joinToken, credential: this.record.credential, name: this.record.name, journal: this.record.journal, prepared: this.record.prepared });
        this.lastSeen = Date.now();
        clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => {
          if (!connection.open || this.connection !== connection) return;
          if (Date.now() - this.lastSeen > 18_000) {
            connection.close(); this.markOffline('L’altro browser non risponde. Attendo il rientro.'); this.scheduleRetry();
          } else this.send({ type: 'ping' });
        }, 5000);
      });
    });
    connection.on('data', value => {
      if (this.connection !== connection || this.stopped || this.paused) return;
      this.lastSeen = Date.now();
      this.enqueue(() => { if (this.connection === connection && !this.paused) return this.receive(value); });
    });
    connection.on('close', () => {
      if (this.connection !== connection || this.stopped || this.paused) return;
      this.generation++;
      clearInterval(this.heartbeat); this.clearWatchdog(); this.authenticated = false;
      if (this.phase !== 'error') this.markOffline('L’altro giocatore si è disconnesso. Il salvataggio è conservato.');
      this.scheduleRetry();
    });
    connection.on('error', () => {
      if (this.connection !== connection || this.stopped || this.paused) return;
      this.markOffline('Connessione interrotta. Attendo il rientro dell’altro giocatore.'); this.scheduleRetry();
    });
  }
  private send(message: Record<string, unknown>) {
    if (!this.connection?.open) throw new Error('Il collegamento è interrotto. Attendi la riconnessione.');
    this.connection.send({ ...message, version: 2 });
  }
  private async receive(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 8_000_000) throw new Error('Messaggio di collegamento non valido.');
    const m = value as Wire;
    if (m.version !== 2 || typeof m.type !== 'string') throw new Error('Le due versioni del gioco non sono compatibili. Aggiornate entrambi la pagina.');
    if (m.type === 'ping') { this.send({ type: 'pong' }); return; }
    if (m.type === 'pong') return;
    if (m.type === 'reject') {
      this.error = textField(m.reason, 'Motivo', 500); this.busy = false; this.phase = 'error'; this.publish(); this.connection?.close(); return;
    }
    if (m.type === 'hello') {
      if (this.record.role !== 'host' || this.authenticated) throw new Error('Richiesta di ingresso inattesa.');
      const credential = textField(m.credential, 'Accesso', 48);
      if (m.roomId !== this.record.roomId || m.token !== this.record.joinToken || !/^[a-f0-9]{48}$/.test(credential)) { this.send({ type: 'reject', reason: 'Invito o accesso non validi.' }); return; }
      if (this.record.guestCredential && this.record.guestCredential !== credential) {
        this.send({ type: 'reject', reason: 'Il posto Blu è già assegnato. Per riprenderlo usa il suo salvataggio o importa il suo backup.' }); return;
      }
      const remote = readJournal(m.journal, this.record.roomId);
      const old = this.record.journal;
      const hostPrepared = this.record.prepared;
      const chosen = reconcile(this.recoverable(old, hostPrepared), this.recoverable(remote, m.prepared));
      this.recovered = Boolean(old.initial && fingerprint(old) !== fingerprint(chosen));
      await this.persist({ ...this.record, journal: chosen, outbox: this.recoveredOutbox(chosen), prepared: null, guestCredential: credential, remoteName: cleanName(textField(m.name, 'Nome', 40)) });
      this.authenticated = true; this.syncDigest = fingerprint(chosen);
      this.send({ type: 'welcome', roomId: this.record.roomId, token: this.record.joinToken, credential, name: this.record.name, journal: chosen, hostJournal: old, hostPrepared }); return;
    }
    if (m.type === 'welcome') {
      if (this.record.role !== 'guest' || this.authenticated || m.roomId !== this.record.roomId || m.token !== this.record.joinToken || m.credential !== this.record.credential) throw new Error('La risposta non corrisponde a questa sessione.');
      const host = readJournal(m.hostJournal, this.record.roomId);
      const chosen = readJournal(m.journal, this.record.roomId);
      if (JSON.stringify(reconcile(this.recoverable(this.record.journal, this.record.prepared), this.recoverable(host, m.hostPrepared))) !== JSON.stringify(chosen)) throw new Error('Il recupero non corrisponde alle cronologie salvate.');
      this.recovered = Boolean(this.record.journal.initial && fingerprint(this.record.journal) !== fingerprint(chosen));
      await this.persist({ ...this.record, journal: chosen, outbox: this.recoveredOutbox(chosen), prepared: null, remoteName: cleanName(textField(m.name, 'Nome', 40)) });
      this.authenticated = true; this.syncDigest = fingerprint(chosen);
      this.send({ type: 'synced', digest: this.syncDigest }); return;
    }
    if (!this.authenticated) throw new Error('Il posto del giocatore non è stato verificato.');
    if (m.type === 'synced') {
      if (this.record.role !== 'host' || m.digest !== this.syncDigest) throw new Error('Conferma di sincronizzazione non valida.');
      this.send({ type: 'ready', digest: this.syncDigest }); this.markReady(); return;
    }
    if (m.type === 'ready') {
      if (this.record.role !== 'guest' || m.digest !== this.syncDigest) throw new Error('Stato sincronizzato non valido.');
      this.markReady(); return;
    }
    if (m.type === 'displayed') {
      if (!Number.isInteger(m.revision) || (m.revision as number) < 0 || (m.revision as number) > revision(this.record.journal) + 1 || typeof m.digest !== 'string' || !/^[a-f0-9]{16}$/.test(m.digest)) return;
      this.remoteDisplayed = `${m.revision}:${m.digest}`; this.publish(); await this.flushOutbox(); return;
    }
    if (m.type === 'request') {
      if (this.record.role !== 'host' || this.phase !== 'connected') throw new Error('Richiesta fuori dalla sessione attiva.');
      const command = readCommand(m.command);
      if (command.actor !== 'blue') throw new Error('L’avversario non può agire per il Rosso.');
      const applied = this.record.journal.events.find(e => e.id === command.id);
      if (applied) {
        if (JSON.stringify(applied) !== JSON.stringify(command)) throw new Error('Identificativo già usato per un comando differente.');
        this.send({ type: 'already-applied', journal: this.record.journal }); return;
      }
      if (m.base !== fingerprint(this.record.journal)) throw new Error('La richiesta si riferisce a una revisione superata. Ricollega i browser.');
      if (!this.displaysAgree()) throw new Error('Attendi che entrambi abbiano visto la sequenza precedente.');
      await this.prepare(command); return;
    }
    if (m.type === 'prepare') {
      if (this.record.role !== 'guest' || this.phase !== 'connected') throw new Error('Preparazione inattesa.');
      const candidate = readJournal(m.journal, this.record.roomId);
      if (!isPrefix(this.record.journal, candidate) || revision(candidate) !== revision(this.record.journal) + 1) throw new Error('La modifica non segue la cronologia concordata.');
      const event = candidate.events[candidate.events.length - 1];
      // Historical archives may contain old passes; a newly proposed command must obey current rules.
      append(this.record.journal, event);
      if (event.actor === 'blue' && event.id !== this.record.outbox?.command.id) throw new Error('Modifica Blu non richiesta da questo giocatore.');
      this.busy = true; this.publish();
      await this.persist({ ...this.record, prepared: candidate });
      this.send({ type: 'prepared', id: event.id, digest: fingerprint(candidate) }); return;
    }
    if (m.type === 'prepared') {
      if (this.record.role !== 'host' || !this.record.prepared) throw new Error('Conferma senza una modifica in attesa.');
      const candidate = this.record.prepared;
      const event = candidate.events[candidate.events.length - 1];
      if (m.id !== event.id || m.digest !== fingerprint(candidate)) throw new Error('La conferma non corrisponde alla modifica preparata.');
      await this.persist({ ...this.record, journal: candidate, outbox: this.recoveredOutbox(candidate), prepared: null });
      this.send({ type: 'commit', id: event.id, journal: candidate }); return;
    }
    if (m.type === 'commit' || m.type === 'already-applied') {
      if (this.record.role !== 'guest') throw new Error('Conferma inattesa dal giocatore Blu.');
      const candidate = readJournal(m.journal, this.record.roomId);
      const equal = JSON.stringify(candidate) === JSON.stringify(this.record.journal);
      const prepared = this.record.prepared && JSON.stringify(candidate) === JSON.stringify(this.record.prepared);
      if (!equal && !prepared) throw new Error('La conferma non corrisponde a una modifica verificata.');
      await this.persist({ ...this.record, journal: candidate, outbox: this.recoveredOutbox(candidate), prepared: null });
      if (m.type === 'commit') this.send({ type: 'committed', id: m.id, digest: fingerprint(candidate) });
      this.busy = false; this.message = 'Stato concordato e salvato su entrambi i browser.'; this.clearWatchdog(); this.publish(); return;
    }
    if (m.type === 'committed') {
      if (this.record.role !== 'host' || m.id !== this.record.journal.events.at(-1)?.id || m.digest !== fingerprint(this.record.journal)) throw new Error('Riscontro finale non valido.');
      this.busy = false; this.message = 'Stato concordato e salvato su entrambi i browser.'; this.clearWatchdog(); this.publish(); return;
    }
    throw new Error('Messaggio non riconosciuto: aggiorna entrambi i browser.');
  }
  private async prepare(command: Command) {
    if (this.busy) throw new Error('Attendi la conferma della modifica precedente.');
    const candidate = append(this.record.journal, command);
    this.busy = true; this.message = 'Confermo e salvo la modifica…'; this.publish();
    await this.persist({ ...this.record, prepared: candidate });
    this.send({ type: 'prepare', journal: candidate });
    this.setWatchdog('La conferma si è interrotta. Ricollega i browser per verificare l’ultima modifica salvata.');
  }
  request(command: Command) {
    return this.enqueue(async () => {
      if (!this.canPlay()) return;
      if (command.actor !== seatFor(this.record.role)) throw new Error('Puoi giocare soltanto per la tua gilda.');
      append(this.record.journal, command);
      // The intent is durable BEFORE its first transmission. Recovery retries this exact ID.
      await this.persist({ ...this.record, outbox: { command: readCommand(command), base: fingerprint(this.record.journal) } });
      await this.flushOutbox();
    });
  }
  private key() { return `${revision(this.record.journal)}:${fingerprint(this.record.journal)}`; }
  private displaysAgree() { return Boolean(this.record.journal.initial && this.localDisplayed === this.key() && this.remoteDisplayed === this.key()); }
  private canPlay() { return this.phase === 'connected' && !this.busy && !this.record.outbox && this.displaysAgree(); }
  displayed = (atRevision: number) => {
    if (!this.record.journal.initial || atRevision !== revision(this.record.journal)) return;
    const key = this.key(), changed = this.localDisplayed !== key;
    this.localDisplayed = key;
    if (this.phase === 'connected' && this.authenticated && this.connection?.open && this.sentDisplayed !== key) {
      this.sentDisplayed = key; this.send({ type: 'displayed', revision: atRevision, digest: fingerprint(this.record.journal) });
    }
    if (changed) this.publish();
    void this.enqueue(() => this.flushOutbox());
  };
  private recoveredOutbox(journal: Journal) {
    return reconcileOutbox(journal, this.record.outbox);
  }
  private recoverable(journal: Journal, value: unknown): Journal {
    if (value == null) return journal;
    const prepared = readJournal(value, journal.roomId);
    if (!isPrefix(journal, prepared) || revision(prepared) !== revision(journal) + 1) throw new Error('Preparazione salvata non coerente con la cronologia.');
    // A prepared command is already a durable, validated intent. The recovery
    // handshake saves it on both peers instead of silently dropping it.
    return prepared;
  }
  private async flushOutbox() {
    if (this.flushing || this.phase !== 'connected' || this.busy || !this.displaysAgree() || !this.record.outbox) return;
    this.flushing = true;
    try {
      const { command, base } = this.record.outbox;
      if (base !== fingerprint(this.record.journal)) throw new Error('Richiesta in sospeso riferita a una revisione differente.');
      if (this.record.role === 'host') await this.prepare(command);
      else {
        this.busy = true; this.message = 'Conferma in corso: la richiesta è salvata e sarà recuperata al rientro.'; this.publish();
        this.send({ type: 'request', command, base });
        this.setWatchdog('Conferma interrotta. Ricollega i browser: la richiesta salvata verrà verificata senza duplicarla.');
      }
    } finally { this.flushing = false; }
  }
  private markReady() {
    this.clearWatchdog(); this.busy = false; this.phase = 'connected'; this.error = '';
    this.message = this.recovered ? 'Partita recuperata all’ultima conferma salvata. Il campo mostra lo stato aggiornato.' : 'Browser collegati. Stato concordato e salvato.'; this.publish();
    if (this.record.journal.initial && this.localDisplayed === this.key()) this.displayed(revision(this.record.journal));
  }
  private markOffline(message: string) {
    this.busy = false; this.phase = 'offline'; this.message = message; this.publish();
  }
  private setWatchdog(message: string) {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      if (this.stopped || this.paused) return;
      this.phase = 'error'; this.error = message; this.busy = false; this.publish();
      this.connection?.close();
    }, 20_000);
  }
  private clearWatchdog() { clearTimeout(this.watchdog); }
  private scheduleRetry() {
    clearTimeout(this.timer);
    if (this.stopped || this.paused || this.phase === 'error') return;
    this.timer = setTimeout(() => {
      if (this.stopped || this.paused) return;
      if (!this.peer || this.peer.destroyed) this.openPeer();
      else if (this.peer.disconnected) { try { this.peer.reconnect(); } catch { this.peer.destroy(); this.peer = undefined; this.openPeer(); } }
      else if (this.record.role === 'guest') this.connectGuest();
    }, 3500);
  }
  pause = () => {
    this.generation++;
    this.paused = true; clearTimeout(this.timer); this.clearWatchdog(); clearInterval(this.heartbeat);
    this.connection?.close(); this.peer?.destroy(); this.peer = undefined; this.connection = undefined;
    this.authenticated = false; this.busy = false; this.phase = 'paused'; this.message = 'Collegamento sospeso. Il salvataggio locale è conservato.'; this.error = ''; this.publish();
  };
  reconnect = () => { this.pause(); this.start(); };
  dispose = () => { this.stopped = true; this.pause(); this.listeners.clear(); };
}

export function connectionLabel(phase: Phase) {
  return { opening: 'Apertura', waiting: 'Invito pronto', connecting: 'Collegamento', syncing: 'Sincronizzazione', connected: 'Sincronizzato', offline: 'In attesa del rientro', paused: 'Sospeso', error: 'Da verificare' }[phase];
}
export const currentMatch = (view: ConnectionView) => replay(view.record.journal);
