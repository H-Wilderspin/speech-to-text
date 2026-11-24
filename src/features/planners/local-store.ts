// Only planner data belongs here. Never put tokens, audio or captions in this DB.
export type PendingEdit<C = unknown> = { id: string; document: string; time: number; change: C };
export type StoredDocument<T = unknown> = { id: string; value: T };
const databaseName = () => `speech-to-text-planners:${new URL(import.meta.env.BASE_URL, document.baseURI).pathname}`;
let connection: Promise<IDBDatabase> | undefined;

function database(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName(), 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('documents', { keyPath: 'id' });
      request.result.createObjectStore('edits', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); connection = undefined; };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Planner storage is busy in another tab.'));
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}

export async function readLocal(): Promise<{ documents: StoredDocument[]; edits: PendingEdit[] }> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['documents', 'edits'], 'readonly');
    const documents = transaction.objectStore('documents').getAll();
    const edits = transaction.objectStore('edits').getAll();
    transaction.oncomplete = () => resolve({ documents: documents.result, edits: edits.result });
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
}

// Cache + acknowledgement and conflict replacement are atomic, including across tabs.
export async function writeLocal({ document, add = [], remove = [] }: {
  document?: StoredDocument; add?: PendingEdit[]; remove?: string[];
}): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['documents', 'edits'], 'readwrite');
    if (document) transaction.objectStore('documents').put(document);
    for (const id of remove) transaction.objectStore('edits').delete(id);
    for (const edit of add) transaction.objectStore('edits').put(edit);
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
}
