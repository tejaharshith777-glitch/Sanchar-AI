import { openDB, DBSchema } from 'idb';

interface SancharDB extends DBSchema {
  cityPacks: {
    key: string;
    value: any;
  };
  offlineQueue: {
    key: number;
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

export async function queueOfflineMutation(url: string, method: string, body: any, idempotencyKey: string) {
  const db = await initDB();
  await db.put('offlineQueue', {
    url,
    method,
    body,
    idempotencyKey,
    timestamp: Date.now()
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
