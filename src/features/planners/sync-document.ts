import { GitHubAccessError, readJsonFile, writeJsonFile } from './github';
import { DeviceAccessError, SyncPausedError } from './family-service';
import { writeLocal, type PendingEdit } from './local-store';

export interface DocumentAdapter<T, C> {
  empty: T;
  parse(value: unknown): T;
  key(change: C): string;
  independent?(change: C): boolean;
  apply(value: T, change: C, force: boolean): T;
  resolve(remote: T, local: T, key: string): C[];
  message: string;
}
export type ItemConflict<C> = { key: string; change: C };
export type SyncSnapshot<T, C> = {
  value: T; loaded: boolean; pending: number; saving: boolean; durable: boolean;
  error: string; conflicts: ItemConflict<C>[]; status: string; confirmed: boolean;
};
export class EditConflict extends Error {}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
let lastTime = 0;
const timestamp = () => (lastTime = Math.max(Date.now(), lastTime + 1));
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// A queue shared by all documents in this tab keeps GitHub writes sequential.
let writer: Promise<unknown> = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const result = writer.then(operation, operation);
  writer = result.catch(() => undefined);
  return result;
}

export class SyncDocument<T, C> {
  private remote: T;
  private edits: PendingEdit<C>[] = [];
  private listeners = new Set<() => void>();
  private persisted = new Set<string>();
  private removed = new Set<string>(); // Ignore stale tab snapshots after a local acknowledgement/choice.
  private unsavedRemovals = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private poll: ReturnType<typeof setInterval> | undefined;
  private firstPending = 0;
  private retryAt = 0;
  private serviceRetryAt = 0;
  private failures = 0;
  private running: Promise<boolean> | undefined;
  private reading: Promise<void> | undefined;
  private persistence: Promise<void> = Promise.resolve();
  private held = false;
  private deferred: Partial<SyncSnapshot<T, C>> = {};
  private active = false;
  private disposed = false;
  private token = '';
  private snapshot: SyncSnapshot<T, C>;
  constructor(readonly path: string, readonly adapter: DocumentAdapter<T, C>,
    private notify: () => void, private accessError: (token: string) => void) {
    this.remote = adapter.empty;
    this.snapshot = { value: adapter.empty, loaded: false, pending: 0, saving: false, durable: true, error: '', conflicts: [], status: 'Loading', confirmed: false };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getRemote = () => this.remote;
  private satisfied(remote: T, edits: PendingEdit<C>[]) {
    const keys = new Set<string>();
    for (const key of new Set(edits.map(edit => this.adapter.key(edit.change)))) {
      try {
        const group = edits.filter(edit => this.adapter.key(edit.change) === key);
        if (group.some(edit => this.adapter.independent?.(edit.change) === false)) continue;
        const wanted = group.reduce((value, edit) => this.adapter.apply(value, edit.change, true), remote);
        if (equal(wanted, remote)) keys.add(key);
      } catch { /* Invalid or incompatible edits remain pending for review. */ }
    }
    return keys;
  }
  private emit(changes: Partial<SyncSnapshot<T, C>> = {}) {
    if (this.held) { Object.assign(this.deferred, changes); return; }
    changes = { ...this.deferred, ...changes };
    this.deferred = {};
    let value = this.remote;
    const conflicts: ItemConflict<C>[] = [];
    const blocked = new Set<string>();
    const satisfied = this.satisfied(this.remote, this.edits);
    for (const edit of this.edits) {
      const key = this.adapter.key(edit.change);
      if (satisfied.has(key)) continue;
      try {
        if (blocked.has(key)) throw new EditConflict();
        value = this.adapter.apply(value, edit.change, false);
      } catch {
        blocked.add(key);
        if (!conflicts.some(item => item.key === key)) conflicts.push({ key, change: edit.change });
        value = this.adapter.apply(value, edit.change, true);
      }
    }
    if (equal(value, this.snapshot.value)) value = this.snapshot.value;
    this.snapshot = { ...this.snapshot, ...changes, value, conflicts, pending: this.edits.length,
      durable: this.unsavedRemovals.size === 0 && this.edits.every(edit => this.persisted.has(edit.id)) };
    for (const listener of this.listeners) listener();
    this.notify();
  }
  restore(value: unknown | undefined, edits: PendingEdit[], replace = false) {
    const stale = edits.some(edit => edit.document === this.path && this.removed.has(edit.id));
    if (value !== undefined && !stale) {
      try { this.remote = this.adapter.parse(value); } catch { /* Invalid cache never replaces a readable document. */ }
    }
    const incoming = edits.filter(edit => edit.document === this.path && !this.removed.has(edit.id)) as PendingEdit<C>[];
    // Retain not-yet-persisted edits when another tab announces a transaction.
    this.edits = [...new Map([...(replace ? this.edits.filter(edit => !this.persisted.has(edit.id)) : this.edits), ...incoming]
      .map(edit => [edit.id, edit])).values()].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    this.persisted = new Set(incoming.map(edit => edit.id));
    if (this.edits.length) this.firstPending ||= Date.now();
    this.emit({ loaded: this.snapshot.loaded || value !== undefined || this.edits.length > 0 });
    this.schedule();
  }
  configure(token: string) {
    const changed = token !== this.token;
    this.token = token;
    this.disposed = false;
    if (changed) { this.retryAt = 0; this.serviceRetryAt = 0; this.failures = 0; }
    this.schedule();
  }
  activate(active: boolean) {
    this.active = active;
    clearInterval(this.poll);
    if (active) {
      void this.refresh();
      this.poll = setInterval(() => { if (!document.hidden) void this.refresh(); }, 60000);
    }
  }
  hold(value: boolean) { this.held = value; if (!value) { this.emit(); this.schedule(); } }
  private persist(add: PendingEdit<C>[], remove: string[] = [], value?: T) {
    for (const id of remove) this.unsavedRemovals.add(id);
    const operation = this.persistence.catch(() => undefined).then(() => writeLocal({
      add, remove, document: value === undefined ? undefined : { id: this.path, value },
    }));
    this.persistence = operation;
    void operation.then(() => {
      for (const edit of add) this.persisted.add(edit.id);
      for (const id of remove) this.persisted.delete(id);
      for (const id of remove) this.unsavedRemovals.delete(id);
      this.emit();
      this.notifyPeers();
    }).catch(() => { if (this.edits.length || this.unsavedRemovals.size) this.emit({ error: 'This browser could not keep changes on this device. Keep the app open until they are saved to GitHub.' }); });
    return operation;
  }
  private notifyPeers() {
    window.dispatchEvent(new Event('planner-local-written'));
  }
  change(change: C): boolean {
    try {
      this.adapter.apply(this.snapshot.value, change, true);
      const edit: PendingEdit<C> = { id: crypto.randomUUID(), document: this.path, time: timestamp(), change };
      if (this.snapshot.conflicts.length) this.retryAt = 0;
      this.edits.push(edit);
      this.firstPending ||= Date.now();
      this.emit({ loaded: true, error: '', status: 'Changes kept on this device' });
      void this.persist([edit]);
      this.schedule();
      return true;
    } catch (error) { this.emit({ error: error instanceof Error ? error.message : 'Could not change this item.' }); return false; }
  }
  resolve(key: string, keepLocal: boolean) {
    const remove = this.edits.filter(edit => this.adapter.key(edit.change) === key).map(edit => edit.id);
    for (const id of remove) this.removed.add(id);
    const changes = keepLocal ? this.adapter.resolve(this.remote, this.snapshot.value, key) : [];
    const add = changes.map(change => ({ id: crypto.randomUUID(), document: this.path, time: timestamp(), change }));
    this.edits = [...this.edits.filter(edit => !remove.includes(edit.id)), ...add];
    this.emit({ error: '' });
    void this.persist(add, remove);
    this.retryAt = 0;
    this.schedule();
  }
  // Cancel our queued operation, or compensate if it may already be on the server.
  // The adapter's inverse must preserve concurrent family changes.
  undoChange(change: C, inverse: C): boolean {
    const pending = this.edits.find(edit => edit.change === change);
    const add = this.running || !pending
      ? [{ id: crypto.randomUUID(), document: this.path, time: timestamp(), change: inverse }] : [];
    try { for (const edit of add) this.adapter.apply(this.snapshot.value, edit.change, true); }
    catch { return false; }
    const remove = pending ? [pending.id] : [];
    for (const id of remove) this.removed.add(id);
    for (const id of remove) this.unsavedRemovals.add(id);
    this.edits = [...this.edits.filter(edit => !remove.includes(edit.id)), ...add];
    this.firstPending = this.edits.length ? Date.now() : 0;
    this.retryAt = 0;
    this.emit({ error: '' });
    void this.persist(add, remove);
    this.schedule();
    return true;
  }
  private schedule() {
    clearTimeout(this.timer);
    if (this.disposed || !this.token || !this.edits.length || this.held || this.running) return;
    const due = Math.max(this.retryAt, this.serviceRetryAt, Math.min(Date.now() + 2000, (this.firstPending || Date.now()) + 10000));
    this.timer = setTimeout(() => { void this.flush(); }, Math.max(0, due - Date.now()));
  }
  refresh = (): Promise<void> => {
    if (this.reading) return this.reading;
    if (this.running || this.held || document.hidden || Date.now() < this.serviceRetryAt) return Promise.resolve();
    const token = this.token;
    this.reading = (async () => {
      try {
        const file = await readJsonFile(this.path, token);
        if (this.disposed || this.held) return;
        this.remote = file.value === undefined ? this.adapter.empty : this.adapter.parse(file.value);
        this.emit({ loaded: true, confirmed: true, error: this.edits.length ? this.snapshot.error : '', status: 'Up to date' });
        await this.persist([], [], this.remote).catch(() => undefined);
      } catch (error) { this.failed(error, token); }
      finally { this.reading = undefined; }
    })();
    return this.reading;
  };
  private failed(error: unknown, token: string) {
    if (error instanceof GitHubAccessError || error instanceof DeviceAccessError) this.accessError(token);
    if (error instanceof SyncPausedError) this.serviceRetryAt = Math.max(this.serviceRetryAt, error.retryAt);
    this.emit({ confirmed: false, error: error instanceof Error ? error.message : 'Could not sync. Your changes are kept here.', status: 'Waiting to sync' });
  }
  flush = (): Promise<boolean> => {
    if (this.running) return this.running;
    if (!this.edits.length) return Promise.resolve(true);
    if (!this.token || this.held) return Promise.resolve(false);
    if (Date.now() < this.serviceRetryAt) { this.schedule(); return Promise.resolve(false); }
    clearTimeout(this.timer);
    this.running = serial(async () => {
      await this.reading;
      await this.persistence.catch(() => undefined);
      const batch = [...this.edits];
      const token = this.token;
      this.emit({ saving: true, status: 'Saving' });
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt) await sleep(250 * 2 ** (attempt - 1));
          const file = await readJsonFile(this.path, token);
          const remote = file.value === undefined ? this.adapter.empty : this.adapter.parse(file.value);
          let next = remote;
          const accepted: string[] = [];
          const blocked = new Set<string>();
          const satisfied = this.satisfied(remote, batch);
          for (const edit of batch) {
            const key = this.adapter.key(edit.change);
            if (satisfied.has(key)) { accepted.push(edit.id); continue; }
            if (blocked.has(key)) continue;
            try { next = this.adapter.apply(next, edit.change, false); accepted.push(edit.id); }
            catch { blocked.add(key); }
          }
          if (!equal(next, remote)) {
            const response = await writeJsonFile(this.path, next, file.sha, token, this.adapter.message);
            if (response.status === 409 || response.status === 422) continue;
            if (!response.ok) throw new Error('GitHub did not save the changes. They are kept here; try again.');
          }
          // Acknowledgement removes only the captured batch; edits made during
          // the request stay queued and are replayed over the saved result.
          this.remote = next;
          for (const id of accepted) this.removed.add(id);
          this.edits = this.edits.filter(edit => !accepted.includes(edit.id));
          await this.persist([], accepted, next).catch(() => undefined);
          this.failures = 0;
          this.retryAt = blocked.size ? Date.now() + 30000 : 0;
          this.firstPending = this.edits.length ? Date.now() : 0;
          this.emit({ loaded: true, confirmed: true, error: '', status: this.edits.length ? 'Changes waiting to sync' : 'Saved' });
          return this.edits.length === 0;
        }
        throw new Error('Other family changes are being saved. Your changes will retry shortly.');
      } catch (error) {
        this.failed(error, token);
        this.retryAt = Math.max(this.retryAt, Date.now() + Math.min(60000, 2000 * 2 ** Math.min(this.failures++, 5)));
        return false;
      } finally { this.emit({ saving: false }); }
    }).finally(() => { this.running = undefined; this.schedule(); });
    return this.running;
  };
  async safeToLeave(): Promise<boolean> {
    await this.persistence.catch(() => undefined);
    if (this.unsavedRemovals.size) {
      try { await this.persist([], [...this.unsavedRemovals], this.remote); }
      catch { return false; }
    }
    if (this.snapshot.durable) { void this.flush(); return true; }
    return this.flush();
  }
  async navigate() {
    await this.persistence.catch(() => undefined);
    void this.flush(); // The app-owned queue remains in memory even if device storage failed.
  }
  wake() { this.retryAt = 0; this.schedule(); if (this.active && !document.hidden) void this.refresh(); }
  dispose() { this.disposed = true; clearTimeout(this.timer); clearInterval(this.poll); }
}
