import type { Match } from './engine/game';
import { readMatch } from './engine/backup';
let database: Promise<IDBDatabase> | undefined;
function open() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('strategic-wizardry-local', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('games', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('Non è possibile aprire i salvataggi locali.')); };
  });
  return database;
}
export async function saveMatch(match: Match, expectedRevision?: number): Promise<void> {
  const validated = readMatch(match), db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('games', 'readwrite'), store = tx.objectStore('games');
    let conflict = false;
    const request = store.get(validated.game.id);
    request.onsuccess = () => {
      if (expectedRevision !== undefined && request.result?.match?.revision !== expectedRevision) { conflict = true; tx.abort(); return; }
      store.put({ id: validated.game.id, match: validated });
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(new Error(conflict ? 'La partita è cambiata in un’altra finestra. Torna al menu e riaprila per recuperare la versione aggiornata.' : 'Salvataggio non riuscito: controlla lo spazio disponibile nel browser.'));
  });
}
export async function loadMatches(): Promise<Match[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction('games').objectStore('games').getAll();
    request.onsuccess = () => {
      const matches: Match[] = [];
      for (const row of request.result) { try { matches.push(readMatch(row.match)); } catch { /* Incompatible data is preserved, never overwritten. */ } }
      resolve(matches.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
    };
    request.onerror = () => reject(new Error('Lettura delle partite salvate non riuscita.'));
  });
}
