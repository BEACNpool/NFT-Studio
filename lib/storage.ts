import type { SavedArtwork } from './art';
const DB = 'nft-studio-artworks-v1';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    let blocked = false;
    request.onupgradeneeded = () =>
      request.result.createObjectStore('artworks', { keyPath: 'id' });
    request.onsuccess = () =>
      blocked ? request.result.close() : resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          'Local storage is unavailable. Export your project to keep it.',
        ),
      );
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close another NFT Studio tab, then try again.'));
    };
  });
}
export async function loadSaved(): Promise<SavedArtwork[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('artworks', 'readonly');
    const request = tx.objectStore('artworks').getAll();
    const fail = () => {
      db.close();
      reject(
        new Error('Your local collection could not be read. Please try again.'),
      );
    };
    tx.onerror = fail;
    tx.onabort = fail;
    tx.oncomplete = () => {
      db.close();
      resolve(
        request.result.sort((a: SavedArtwork, b: SavedArtwork) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
    };
  });
}
export async function saveRecords(records: SavedArtwork[]) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('artworks', 'readwrite');
    const fail = () => {
      db.close();
      reject(
        new Error(
          'Device storage is full or unavailable. Export your artwork instead.',
        ),
      );
    };
    tx.onerror = fail;
    tx.onabort = fail;
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    try {
      records.forEach((record) => tx.objectStore('artworks').put(record));
    } catch {
      tx.abort();
    }
  });
}
export async function removeRecord(id: string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('artworks', 'readwrite');
    const fail = () => {
      db.close();
      reject(new Error('The artwork could not be removed. Please try again.'));
    };
    tx.onerror = fail;
    tx.onabort = fail;
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.objectStore('artworks').delete(id);
  });
}
