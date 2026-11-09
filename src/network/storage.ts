import { readSession, reconcile, reconcileOutbox, type SessionRecord } from './model';
export const sessionKey = (r: SessionRecord) => `${r.roomId}:${r.role}:${r.credential}`;
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('strategic-wizardry-online', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sessions', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('Salvataggio locale non disponibile. Controlla le impostazioni del browser.')); };
    request.onblocked = () => reject(new Error('Il salvataggio è bloccato da un’altra finestra. Chiudila e riprova.'));
  });
  return database;
}
export async function saveSession(record: SessionRecord): Promise<void> {
  readSession(record);
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    let failure: Error | undefined;
    const request = store.get(sessionKey(record));
    request.onsuccess = () => {
      try {
        const old = request.result?.record as SessionRecord | undefined;
        if (old ? old.storageVersion !== record.storageVersion - 1 : record.storageVersion !== 0) throw new Error('Il salvataggio è cambiato in un’altra scheda. Chiudila e riapri la partita da questo browser.');
        store.put({ key: sessionKey(record), record });
      } catch (e) { failure = e instanceof Error ? e : new Error('Salvataggio non riuscito.'); tx.abort(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(failure ?? new Error('Impossibile salvare la sessione: spazio esaurito o archiviazione bloccata. Esporta un backup prima di chiudere.'));
  });
}

/** Import never replaces a newer or divergent journal, nor changes the seat credentials. */
export async function importSession(record: SessionRecord): Promise<SessionRecord> {
  const old = (await listSessions()).find(item => sessionKey(item) === sessionKey(record));
  const next = mergeImportedSession(record, old);
  await saveSession(next); return next;
}
export function mergeImportedSession(record: SessionRecord, old?: SessionRecord): SessionRecord {
  if (old && sessionKey(old) !== sessionKey(record)) throw new Error('I backup appartengono a posti differenti.');
  if (old && (old.hostPeerId !== record.hostPeerId || old.joinToken !== record.joinToken || old.guestCredential && record.guestCredential && old.guestCredential !== record.guestCredential)) throw new Error('Gli accessi dei due backup non corrispondono.');
  const journal = old ? reconcile(old.journal, record.journal) : record.journal;
  let recoverable = journal;
  for (const candidate of [old?.prepared, record.prepared]) if (candidate) recoverable = reconcile(recoverable, candidate);
  const prepared = recoverable.events.length > journal.events.length ? recoverable : null;
  const pending = [old?.outbox, record.outbox].map(item => reconcileOutbox(journal, item ?? null)).filter(item => item !== null);
  for (const item of pending) reconcileOutbox(recoverable, item);
  if (pending.length === 2 && JSON.stringify(pending[0]) !== JSON.stringify(pending[1])) throw new Error('I backup contengono due richieste in sospeso differenti. Sono stati conservati.');
  return readSession({ ...record, ...old, guestCredential: old?.guestCredential ?? record.guestCredential, remoteName: old?.remoteName || record.remoteName, journal, prepared, outbox: pending[0] ?? null, storageVersion: old ? old.storageVersion + 1 : 0 });
}
export async function listSessions(): Promise<SessionRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('sessions').objectStore('sessions').getAll();
    request.onsuccess = () => {
      const records: SessionRecord[] = [];
      for (const row of request.result) { try { records.push(readSession(row.record)); } catch { /* Older incompatible saves remain untouched. */ } }
      resolve(records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    };
    request.onerror = () => reject(new Error('Non è stato possibile leggere i salvataggi locali.'));
  });
}
