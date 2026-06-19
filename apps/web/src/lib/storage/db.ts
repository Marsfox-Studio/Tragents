// Minimal Promise-wrapping IndexedDB layer. No external dep.

const DB_NAME = 'tragents';
const DB_VERSION = 4;

export const STORES = {
  settings: 'settings',
  providers: 'providers',
  projects: 'projects',
  glossaries: 'glossaries',
  tasks: 'tasks',
  checkpoints: 'checkpoints',
  sessions: 'sessions',
  activities: 'activities',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab.'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings);
      }
      if (!db.objectStoreNames.contains(STORES.providers)) {
        db.createObjectStore(STORES.providers, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.projects)) {
        db.createObjectStore(STORES.projects, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.glossaries)) {
        db.createObjectStore(STORES.glossaries, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.tasks)) {
        db.createObjectStore(STORES.tasks, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.checkpoints)) {
        const store = db.createObjectStore(STORES.checkpoints, { keyPath: 'id' });
        store.createIndex('byProject', 'projectId');
      }
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        const store = db.createObjectStore(STORES.sessions, { keyPath: 'id' });
        store.createIndex('byProject', 'projectId');
        store.createIndex('byUpdated', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(STORES.activities)) {
        const store = db.createObjectStore(STORES.activities, { keyPath: 'id' });
        store.createIndex('byProject', 'projectId');
        store.createIndex('byCreated', 'createdAt');
      }
    };
  });
  return dbPromise;
}

async function tx<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return await new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = run(transaction.objectStore(store));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export const idbGet = <T>(store: StoreName, key: IDBValidKey) =>
  tx<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);

export const idbGetAll = <T>(store: StoreName) =>
  tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);

export const idbPut = <T>(store: StoreName, value: T, key?: IDBValidKey) =>
  tx<IDBValidKey>(store, 'readwrite', (s) =>
    key !== undefined ? s.put(value, key) : s.put(value),
  );

export const idbDelete = (store: StoreName, key: IDBValidKey) =>
  tx<undefined>(store, 'readwrite', (s) => s.delete(key) as IDBRequest<undefined>);

export const idbClear = (store: StoreName) =>
  tx<undefined>(store, 'readwrite', (s) => s.clear() as IDBRequest<undefined>);
