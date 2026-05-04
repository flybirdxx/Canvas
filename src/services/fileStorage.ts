// src/services/fileStorage.ts
const DB_NAME = 'ai-canvas-blobs';
const BLOB_STORE = 'blobs';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Store a data URL as a blob under `key`. Returns the key. */
export async function storeBlob(key: string, dataUrl: string): Promise<string> {
  const db = await openDb();
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.objectStore(BLOB_STORE).put(blob, key);
    tx.oncomplete = () => { db.close(); resolve(key); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Retrieve a blob by key, return as data URL. */
export async function readBlob(key: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    const req = tx.objectStore(BLOB_STORE).get(key);
    req.onsuccess = () => {
      const blob = req.result as Blob | undefined;
      if (!blob) { db.close(); resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => { db.close(); resolve(reader.result as string); };
      reader.onerror = () => { db.close(); reject(reader.error); };
      reader.readAsDataURL(blob);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Delete a blob by key. */
export async function deleteBlob(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    tx.objectStore(BLOB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
  });
}

/** Generate a small storage key from an element id. */
export function blobKey(elementId: string): string {
  return `${elementId}_${Date.now()}`;
}

/** Threshold: files > 1MB use IndexedDB. */
export const BLOB_THRESHOLD_BYTES = 1 * 1024 * 1024;
