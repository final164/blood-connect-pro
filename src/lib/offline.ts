/**
 * Offline-first helpers: cache reads + queue writes when offline.
 * Native apps can reuse the same IndexedDB key schema via SQLite.
 */
const DB_NAME = "bloodlink-offline-v1";
const STORE = "kv";
const QUEUE = "outbox";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheSet(key: string, value: unknown) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ value, at: Date.now() }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result?.value as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export type OutboxItem = {
  id?: number;
  entity: string;
  payload: unknown;
  createdAt: number;
};

export async function enqueueWrite(entity: string, payload: unknown) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE, "readwrite");
    tx.objectStore(QUEUE).add({ entity, payload, createdAt: Date.now() } satisfies OutboxItem);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function drainOutbox(handler: (item: OutboxItem) => Promise<void>) {
  const db = await openDb();
  const items = await new Promise<OutboxItem[]>((resolve, reject) => {
    const tx = db.transaction(QUEUE, "readonly");
    const req = tx.objectStore(QUEUE).getAll();
    req.onsuccess = () => resolve(req.result as OutboxItem[]);
    req.onerror = () => reject(req.error);
  });
  for (const item of items) {
    await handler(item);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE, "readwrite");
      if (item.id != null) tx.objectStore(QUEUE).delete(item.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export function useOnlineStatus() {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}
