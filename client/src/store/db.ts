import { openDB } from 'idb';
import type { DBSchema } from 'idb';

interface SancharDB extends DBSchema {
  cityPacks: {
    key: string;
    value: any;
  };
  offlineQueue: {
    key: string;
    value: {
      url: string;
      method: string;
      body: any;
      idempotencyKey: string;
      timestamp: number;
    };
  };
}

const DB_NAME = 'sanchar-ai-db';
const DB_VERSION = 1;

export async function initDB() {
  return openDB<SancharDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cityPacks')) {
        db.createObjectStore('cityPacks', { keyPath: 'city' });
      }
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { keyPath: 'idempotencyKey' });
      }
    },
  });
}

/**
 * Queue an offline mutation.
 * Accepts either (url, method, body, key) or a single object { url, method, body }.
 */
export async function queueOfflineMutation(
  urlOrObj: string | { url: string; method: string; body: any },
  method?: string,
  body?: any,
  idempotencyKey?: string
) {
  const db = await initDB();
  let url: string;
  let m: string;
  let b: any;
  let key: string;

  if (typeof urlOrObj === 'object') {
    url = urlOrObj.url;
    m = urlOrObj.method;
    b = urlOrObj.body;
    key = crypto.randomUUID();
  } else {
    url = urlOrObj;
    m = method!;
    b = body;
    key = idempotencyKey || crypto.randomUUID();
  }

  await db.put('offlineQueue', {
    url,
    method: m,
    body: b,
    idempotencyKey: key,
    timestamp: Date.now(),
  });
}

export async function getOfflineQueue() {
  const db = await initDB();
  return db.getAll('offlineQueue');
}

export async function removeQueueItem(idempotencyKey: string) {
  const db = await initDB();
  return db.delete('offlineQueue', idempotencyKey);
}

export async function cacheCityPack(city: string, packData: any) {
  const db = await initDB();
  await db.put('cityPacks', packData);
}

export async function getCachedCityPack(city: string) {
  const db = await initDB();
  return db.get('cityPacks', city);
}
