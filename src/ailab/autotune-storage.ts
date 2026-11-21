import type { SearchRun } from './autotune';
import type { ContinuousRun } from './continuous';

async function checkpoint<T extends { id: string; revision: number }>(key: string, next?: T, previous?: T): Promise<T | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('strategic-wizardry-autotune', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('runs');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('runs', next ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('runs');
      const request = store.get(key);
      let saved: T | undefined, conflict = false;
      request.onsuccess = () => {
        saved = request.result;
        if (!next) return;
        if (saved?.id !== previous?.id || saved?.revision !== previous?.revision) {
          conflict = true;
          transaction.abort();
        } else {
          store.put(next, key);
        }
      };
      transaction.oncomplete = () => resolve(next ?? saved);
      transaction.onabort = () => reject(conflict ? new Error('AutoTune è già cambiato in un’altra scheda. Esporta il risultato locale o ricarica la pagina.') : transaction.error);
    });
  } finally { db.close(); }
}

export const searchCheckpoint = (next?: SearchRun, previous?: SearchRun) => checkpoint('latest', next, previous);
export const continuousCheckpoint = (next?: ContinuousRun, previous?: ContinuousRun) => checkpoint('continuous', next, previous);
