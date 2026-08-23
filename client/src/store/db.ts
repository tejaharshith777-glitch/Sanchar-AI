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
  photos: {
    key: string;
    value: {
      tripId: string;
      id: string;
      dataUrl: string; // Will store WebP blob/dataUrl
      timestamp: number;
      lat?: number;
      lng?: number;
    };
    indexes: { 'by-trip': string };
  };
}

const DB_NAME = 'sanchar-ai-db';
const DB_VERSION = 2;

export async function initDB() {
  return openDB<SancharDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cityPacks')) {
        db.createObjectStore('cityPacks', { keyPath: 'city' });
      }
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { keyPath: 'idempotencyKey' });
      }
      if (!db.objectStoreNames.contains('photos')) {
        const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
        photoStore.createIndex('by-trip', 'tripId');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('moments')) {
        const momentStore = db.createObjectStore('moments', { keyPath: 'id' });
        momentStore.createIndex('by-trip', 'tripId');
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
  await db.put('cityPacks', { ...packData, city });
}

export async function getCachedCityPack(city: string) {
  const db = await initDB();
  return db.get('cityPacks', city);
}

// ─── PHOTOS (Gallery) ───
export async function savePhoto(tripId: string, fileOrDataUrl: File | string, lat?: number, lng?: number) {
  const db = await initDB();
  const id = crypto.randomUUID();
  
  // Downscale and convert to WebP
  let imgSource = '';
  if (typeof fileOrDataUrl === 'string') {
    imgSource = fileOrDataUrl;
  } else {
    imgSource = URL.createObjectURL(fileOrDataUrl);
  }

  const processedDataUrl = await new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const MAX_WIDTH = 1280;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.8));
      } else {
        resolve(imgSource);
      }
      if (typeof fileOrDataUrl !== 'string') URL.revokeObjectURL(imgSource);
    };
    img.onerror = () => {
      if (typeof fileOrDataUrl !== 'string') URL.revokeObjectURL(imgSource);
      reject(new Error('Failed to load image for processing'));
    };
    img.src = imgSource;
  });

  await db.put('photos', {
    id,
    tripId,
    dataUrl: processedDataUrl,
    timestamp: Date.now(),
    lat,
    lng
  });
  return id;
}

export async function deletePhoto(id: string) {
  const db = await initDB();
  await db.delete('photos', id);
}

export async function getPhotosForTrip(tripId: string) {
  const db = await initDB();
  return db.getAllFromIndex('photos', 'by-trip', tripId);
}

// ─── VAULT (Settings) ───
export async function hasVaultPin(): Promise<boolean> {
  const db = await initDB();
  const pinObj = await db.get('settings', 'vault_pin');
  return !!pinObj;
}

export async function setVaultPin(pin: string): Promise<void> {
  const db = await initDB();
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const saltArray = Array.from(salt);
  await db.put('settings', { id: 'vault_pin', hash: hashArray, salt: saltArray });
}

export async function verifyVaultPin(pin: string): Promise<boolean> {
  const db = await initDB();
  const stored = await db.get('settings', 'vault_pin');
  if (!stored) return false;
  
  const enc = new TextEncoder();
  const salt = new Uint8Array(stored.salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  
  const attemptArray = Array.from(new Uint8Array(hashBuffer));
  if (attemptArray.length !== stored.hash.length) return false;
  let match = true;
  for (let i = 0; i < attemptArray.length; i++) {
    if (attemptArray[i] !== stored.hash[i]) match = false;
  }
  return match;
}

export async function isWebAuthnAvailable(): Promise<boolean> {
  if (!window.isSecureContext) return false;
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const charCode of bytes) str += String.fromCharCode(charCode);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function registerVaultFingerprint(): Promise<boolean> {
  if (!(await isWebAuthnAvailable())) return false;
  const db = await initDB();
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Sanchar AI Vault', id: window.location.hostname },
        user: { id: userId, name: 'vault_user', displayName: 'Vault User' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      }
    }) as PublicKeyCredential;
    if (credential) {
      await db.put('settings', { id: 'vault_credential_id', credId: bufferToBase64url(credential.rawId) });
      return true;
    }
  } catch (e) {
    console.warn('WebAuthn registration failed:', e);
  }
  return false;
}

export async function verifyVaultFingerprint(): Promise<boolean> {
  if (!(await isWebAuthnAvailable())) return false;
  const db = await initDB();
  const storedCred = await db.get('settings', 'vault_credential_id');
  if (!storedCred) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        userVerification: 'required',
        timeout: 60000
      }
    });
    if (assertion) return true;
  } catch (e) {
    console.warn('WebAuthn verification failed:', e);
  }
  return false;
}

// ─── MARKED MOMENTS ───
export async function saveMarkedMoment(tripId: string, type: string, note: string, data: any) {
  const db = await initDB();
  const id = crypto.randomUUID();
  await db.put('moments', { id, tripId, type, note, data, timestamp: Date.now() });
  return id;
}

export async function getMarkedMoments(tripId: string) {
  const db = await initDB();
  return db.getAllFromIndex('moments', 'by-trip', tripId);
}
