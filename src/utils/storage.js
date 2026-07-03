/**
 * IndexedDB-based storage for large JSON data (50MB+).
 * Stores raw JSON text, not parsed objects, so re-parsing always uses
 * the current parser logic.
 */

const DB_NAME = 'chatgpt-viewer';
const DB_VERSION = 1;
const STORE_NAME = 'cache';
const KEY = 'raw-json';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      event.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Store raw JSON text in IndexedDB */
export async function saveRawJson(text) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(text, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Load raw JSON text from IndexedDB (returns null if none) */
export async function loadRawJson() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/** Delete cached data from IndexedDB */
export async function clearCachedData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get approximate size of cached data in bytes */
export async function getCacheSize() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(KEY);
    request.onsuccess = () => {
      const text = request.result;
      if (!text) resolve(0);
      // JavaScript strings use UTF-16, 2 bytes per char
      resolve(text.length * 2);
    };
    request.onerror = () => reject(request.error);
  });
}
