import { profileSummary, validateProfile, type ProfileStore, type SpeakerProfile } from './profiles';
import { notifyProfileChange } from './profile-changes';

/** A distinct database per app path avoids collisions with other GitHub Pages projects. */
export class IndexedDbProfiles implements ProfileStore {
  private database?: Promise<IDBDatabase>;
  private closed = false;

  constructor(private readonly name: string, private readonly factory: IDBFactory | undefined = globalThis.indexedDB) {}

  private open(): Promise<IDBDatabase> {
    if (this.closed) return Promise.reject(new Error('Speaker storage is closed.'));
    if (!this.database) {
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        if (!this.factory) { reject(new Error('This browser does not offer local speaker storage.')); return; }
        const request = this.factory.open(this.name, 1);
        let expired = false;
        const timer = setTimeout(() => {
          expired = true; reject(new Error('Speaker storage did not open. Close other app tabs and retry.'));
        }, 10000);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('profiles')) request.result.createObjectStore('profiles', { keyPath: 'id' });
        };
        request.onerror = () => { clearTimeout(timer); reject(new Error('Speaker storage is unavailable. Check browser storage settings.')); };
        request.onblocked = () => {
          clearTimeout(timer); expired = true;
          reject(new Error('Close other app tabs to open speaker storage.'));
        };
        request.onsuccess = () => {
          clearTimeout(timer);
          const db = request.result;
          if (expired || this.closed) { db.close(); reject(new Error('Speaker storage is closed.')); return; }
          db.onversionchange = () => { db.close(); this.database = undefined; };
          resolve(db);
        };
      });
      void this.database.catch(() => { this.database = undefined; });
    }
    return this.database;
  }

  private async transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    const db = await this.open();
    signal?.throwIfAborted();
    if (this.closed) throw new Error('Speaker storage is closed.');
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('profiles', mode);
      const abort = () => { try { transaction.abort(); } catch { /* Already committed or aborted. */ } };
      signal?.addEventListener('abort', abort, { once: true });
      const cleanup = () => signal?.removeEventListener('abort', abort);
      // Request success is not durable success; wait for transaction completion.
      let request: IDBRequest<T>;
      transaction.oncomplete = () => { cleanup(); resolve(request.result); };
      transaction.onabort = () => {
        cleanup(); reject(signal?.aborted ? signal.reason : new Error('Speaker storage failed. Check available space and browser settings.'));
      };
      try { request = action(transaction.objectStore('profiles')); }
      catch (error) { abort(); cleanup(); reject(error); }
    });
  }

  async list() {
    const profiles = await this.transact<SpeakerProfile[]>('readonly', (store) => store.getAll());
    try { return profiles.map(profileSummary).sort((a, b) => a.displayName.localeCompare(b.displayName)); }
    finally { for (const profile of profiles) if (Array.isArray(profile?.embedding)) profile.embedding.fill(0); }
  }

  async save(profile: SpeakerProfile, signal: AbortSignal, replaceExisting = false) {
    const safe = validateProfile(profile);
    try {
      if (replaceExisting) await this.transact('readwrite', (store) => {
        const request = store.getKey(safe.id);
        request.onsuccess = () => {
          if (request.result === undefined) store.transaction.abort();
          else store.put(safe);
        };
        return request;
      }, signal);
      else await this.transact('readwrite', (store) => store.add(safe), signal);
      notifyProfileChange(this.name);
    }
    finally { safe.embedding.fill(0); }
  }
  async read(id: string, signal: AbortSignal) {
    const profile = await this.transact<SpeakerProfile | undefined>('readonly', (store) => store.get(id), signal);
    if (!profile) return undefined;
    try { signal.throwIfAborted(); return validateProfile(profile); }
    finally { if (Array.isArray(profile.embedding)) profile.embedding.fill(0); }
  }
  async remove(id: string) { await this.transact('readwrite', (store) => store.delete(id)); notifyProfileChange(this.name); }
  async clear() { await this.transact('readwrite', (store) => store.clear()); notifyProfileChange(this.name); }
  close() { this.closed = true; void this.database?.then((db) => db.close(), () => {}); }
}
