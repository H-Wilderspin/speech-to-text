import { mealDocument } from '../meals/meal-document';
import { shoppingDocument } from '../shopping/shopping-document';
import { readLocal } from './local-store';
import { SyncDocument, type DocumentAdapter } from './sync-document';
import { PlannerDrafts } from './drafts';

// A client lives for the app session, not for a visible screen. Hiding a planner
// therefore never abandons its local queue or stops its background saves.
export class PlannerSync {
  private documents = new Map<string, SyncDocument<unknown, unknown>>();
  private listeners = new Set<() => void>();
  private token = '';
  private channel?: BroadcastChannel;
  private accessError: (token: string) => void = () => undefined;
  private state = { pending: 0, saving: false, durable: true, conflict: false, confirmed: false, error: false, drafts: 0, draftsDurable: true };
  private drafts = new PlannerDrafts();
  ready: Promise<void> = Promise.resolve();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private notify = () => {
    const snapshots = [...this.documents.values()].map(document => document.getSnapshot());
    this.state = { pending: snapshots.reduce((sum, snapshot) => sum + snapshot.pending, 0),
      saving: snapshots.some(snapshot => snapshot.saving), durable: snapshots.every(snapshot => snapshot.durable),
      conflict: snapshots.some(snapshot => snapshot.conflicts.length > 0),
      confirmed: snapshots.some(snapshot => snapshot.confirmed), error: snapshots.some(snapshot => !!snapshot.error),
      drafts: this.drafts.count, draftsDurable: this.drafts.durable };
    for (const listener of this.listeners) listener();
  };
  document<T, C>(path: string, adapter: DocumentAdapter<T, C>): SyncDocument<T, C> {
    if (!this.documents.has(path)) {
      const document = new SyncDocument(path, adapter, this.notify, token => this.accessError(token));
      this.documents.set(path, document as SyncDocument<unknown, unknown>);
      document.configure(this.token);
    }
    return this.documents.get(path)! as SyncDocument<T, C>;
  }
  meals(week?: string) { return this.document(week ? `weeks/${week}.json` : 'defaults.json', mealDocument(week)); }
  shopping() { return this.document('shopping/list.json', shoppingDocument); }
  getDraft<T>(key: string): T | null { return this.drafts.get<T>(key); }
  draftWeek() { return this.drafts.latestMealWeek(); }
  setDraft(key: string, value: unknown) { this.drafts.set(key, value); this.notify(); }
  private restore = async () => {
    try {
      const stored = await readLocal();
      for (const path of new Set([...stored.documents.map(value => value.id), ...stored.edits.map(value => value.document)])) {
        if (path === 'shopping/list.json') this.shopping();
        else if (path === 'defaults.json') this.meals();
        else if (/^weeks\/\d{4}-\d{2}-\d{2}\.json$/.test(path)) this.meals(path.slice(6, -5));
      }
      for (const [path, document] of this.documents) document.restore(stored.documents.find(value => value.id === path)?.value, stored.edits, true);
    } catch { /* Network reads still work. A failed edit persistence is reported by its document. */ }
  };
  configure(token: string, onAccessError: (token: string) => void) {
    this.token = token; this.accessError = onAccessError;
    for (const document of this.documents.values()) document.configure(token);
  }
  start() {
    this.ready = this.restore();
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`speech-to-text-planners:${new URL(import.meta.env.BASE_URL, document.baseURI).pathname}`);
      this.channel.onmessage = () => { void this.restore(); };
    }
    window.addEventListener('planner-local-written', this.written);
    window.addEventListener('focus', this.wake);
    window.addEventListener('online', this.wake);
    document.addEventListener('visibilitychange', this.wake);
    window.addEventListener('beforeunload', this.beforeUnload);
  }
  private written = () => { this.channel?.postMessage('changed'); };
  private wake = () => { for (const document of this.documents.values()) document.wake(); };
  private beforeUnload = (event: BeforeUnloadEvent) => {
    if (!this.state.durable || !this.state.draftsDurable) { event.preventDefault(); event.returnValue = ''; }
  };
  async safeToLeave() {
    await this.ready;
    if (!this.drafts.durable) return false;
    return (await Promise.all([...this.documents.values()].map(document => document.safeToLeave()))).every(Boolean);
  }
  async navigate() {
    // Give ordinary local writes a chance to finish, but never lock the shell
    // behind storage. This client owns pending edits across screen changes.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const persist = this.ready.then(() => Promise.all([...this.documents.values()].map(document => document.navigate())));
    try {
      await Promise.race([persist, new Promise<void>(resolve => { timer = setTimeout(resolve, 150); })]);
    } finally { clearTimeout(timer); }
  }
  stop() {
    this.channel?.close();
    for (const document of this.documents.values()) document.dispose();
    window.removeEventListener('planner-local-written', this.written);
    window.removeEventListener('focus', this.wake);
    window.removeEventListener('online', this.wake);
    document.removeEventListener('visibilitychange', this.wake);
    window.removeEventListener('beforeunload', this.beforeUnload);
  }
}
