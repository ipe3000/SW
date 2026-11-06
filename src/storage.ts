import { readSession, type SessionRecord } from './model';
export const sessionKey = (r: SessionRecord) => `${r.roomId}:${r.role}:${r.credential}`;
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('strategic-wizardry-lab', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sessions', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('Salvataggio locale non disponibile. Controlla le impostazioni del browser.')); };
    request.onblocked = () => reject(new Error('Il salvataggio è bloccato da un’altra finestra. Chiudila e riprova.'));
  });
  return database;
}
export async function saveSession(record: SessionRecord): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put({ key: sessionKey(record), record });
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(new Error('Impossibile salvare la sessione: spazio esaurito o archiviazione bloccata. Esporta un backup prima di chiudere.'));
  });
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
