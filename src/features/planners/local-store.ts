// Only planner data belongs here. Never put tokens, audio or captions in this DB.
export type PendingEdit<C = unknown> = { id: string; document: string; time: number; change: C };
export type StoredDocument<T = unknown> = { id: string; value: T };
const databaseName = () => `speech-to-text-planners:${new URL(import.meta.env.BASE_URL, document.baseURI).pathname}`;
let connection: Promise<IDBDatabase> | undefined;
const STORAGE_TIMEOUT_MS = 3000;

function database(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName(), 1);
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true; clearTimeout(timer); reject(error);
    };
    const timer = setTimeout(() => fail(new Error('Planner storage did not respond.')), STORAGE_TIMEOUT_MS);
    request.onupgradeneeded = () => {
      if (settled) { request.transaction?.abort(); return; }
      request.result.createObjectStore('documents', { keyPath: 'id' });
      request.result.createObjectStore('edits', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      // An open request cannot be cancelled. Close a late result instead of
      // leaking a connection or replacing a newer recovery attempt.
      if (settled) { request.result.close(); return; }
      settled = true; clearTimeout(timer);
      request.result.onversionchange = () => { request.result.close(); connection = undefined; };
      request.result.onclose = () => { connection = undefined; };
      resolve(request.result);
    };
    request.onerror = () => fail(request.error);
    request.onblocked = () => fail(new Error('Planner storage is busy in another tab.'));
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}

function transact<T>(db: IDBDatabase, mode: IDBTransactionMode, operation: (transaction: IDBTransaction) => () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['documents', 'edits'], mode);
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true; clearTimeout(timer); reject(error);
    };
    const timer = setTimeout(() => {
      fail(new Error('Planner storage did not respond.'));
      // Prevent a late write from resurrecting edits that a remote save has
      // since acknowledged. Closing also lets a later attempt open afresh.
      try { transaction.abort(); } catch { /* The browser may already have ended it. */ }
      db.close(); connection = undefined;
    }, STORAGE_TIMEOUT_MS);
    transaction.onabort = transaction.onerror = () => fail(transaction.error);
    try {
      const result = operation(transaction);
      transaction.oncomplete = () => {
        if (settled) return;
        try {
          const value = result();
          settled = true; clearTimeout(timer); resolve(value);
        } catch (error) { fail(error); }
      };
    } catch (error) {
      fail(error);
      try { transaction.abort(); } catch { /* Already ended. */ }
    }
  });
}

export async function readLocal(): Promise<{ documents: StoredDocument[]; edits: PendingEdit[] }> {
  const db = await database();
  return transact(db, 'readonly', transaction => {
    const documents = transaction.objectStore('documents').getAll();
    const edits = transaction.objectStore('edits').getAll();
    return () => ({ documents: documents.result, edits: edits.result });
  });
}

// Cache + acknowledgement and conflict replacement are atomic, including across tabs.
export async function writeLocal({ document, add = [], remove = [] }: {
  document?: StoredDocument; add?: PendingEdit[]; remove?: string[];
}): Promise<void> {
  const db = await database();
  return transact(db, 'readwrite', transaction => {
    if (document) transaction.objectStore('documents').put(document);
    for (const id of remove) transaction.objectStore('edits').delete(id);
    for (const edit of add) transaction.objectStore('edits').put(edit);
    return () => undefined;
  });
}
