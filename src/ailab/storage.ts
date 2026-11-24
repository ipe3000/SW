import type { Campaign } from './model';
const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('strategic-wizardry-ailab', 2);
  request.onupgradeneeded = () => {
    if (request.result.objectStoreNames.contains('campaigns')) request.result.deleteObjectStore('campaigns');
    request.result.createObjectStore('campaigns');
  };
  request.onblocked = () => reject(new Error('Chiudi le altre schede di AILab e ricarica la pagina.'));
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function save(campaign: Campaign): Promise<void> {
  const db = await open();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('campaigns', 'readwrite');
    tx.objectStore('campaigns').put(campaign, campaign.study ?? 'latest');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
}
export async function restore(study?: Campaign['study']): Promise<Campaign | undefined> {
  const db = await open();
  try { return await new Promise<Campaign | undefined>((resolve, reject) => {
    const request = db.transaction('campaigns').objectStore('campaigns').get(study ?? 'latest');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
