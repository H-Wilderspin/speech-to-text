import type { TranscriptionEngine, TranscriptionSnapshot, TranscriptSegment } from '../types';
import type { LocalListeningEngine } from '../local/types';
import { delayedNames } from './align';

const active = (snapshot: TranscriptionSnapshot) => ['requesting-permission', 'listening', 'stopping'].includes(snapshot.phase);

/** Browser words are authoritative. The independent local path may only add
 * delayed, explicitly experimental estimates; its failures cannot stop captions. */
export class DelayedNamesEngine implements LocalListeningEngine {
  private snapshot: TranscriptionSnapshot;
  private history: TranscriptSegment[] = [];
  private listeners = new Set<() => void>();
  private unwatch: (() => void)[] = [];
  private running = false;
  private starting = false;
  private namesStarted = false;
  private notice: string | undefined;
  constructor(private readonly browser: TranscriptionEngine, private readonly local: LocalListeningEngine) {
    this.snapshot = browser.getSnapshot();
  }
  get unavailableReason() { return this.browser.unavailableReason; }
  getSnapshot = () => this.snapshot;
  getPreparationSnapshot = () => this.local.getPreparationSnapshot();
  private connect() {
    if (this.unwatch.length) return;
    this.unwatch = [this.browser.subscribe(() => this.update()), this.local.subscribe(() => this.update())];
  }
  subscribe = (listener: () => void) => {
    this.connect(); this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  };
  prepare = async (cachedOnly = false) => { this.connect(); await this.local.prepare(cachedOnly); };
  cancelPreparation = () => this.local.cancelPreparation();
  private update() {
    if (this.starting) return;
    const browser = this.browser.getSnapshot();
    let local = this.local.getSnapshot();
    if (this.running && !active(browser) && active(local)) {
      // Clear this guard before synchronous stop notifications reenter update.
      this.running = false;
      if (browser.phase === 'error') this.local.interrupt(); else this.local.stop();
      local = this.local.getSnapshot();
    }
    if (this.namesStarted && (local.phase === 'error' || (this.running && active(browser) && !active(local)
      && this.local.getPreparationSnapshot().phase !== 'ready'))) {
      this.notice = `Speaker estimates unavailable: ${local.message}${active(browser) ? ' Browser captions continue.' : ''}`;
    }
    const finishing = !active(browser) && active(local);
    const segments = [...this.history, ...delayedNames(browser.segments, this.namesStarted ? local.segments : [])];
    let excess = segments.reduce((total, segment) => total + segment.text.length, 0) - 100000;
    while (excess > 0 && segments.length) {
      const first = segments[0]!;
      if (first.text.length <= excess) { excess -= first.text.length; segments.shift(); }
      else { segments[0] = { ...first, text: first.text.slice(excess) }; excess = 0; }
    }
    // Keep completed manual sessions isolated from the next session's evidence.
    if (!active(browser) && !active(local)) this.running = false;
    this.snapshot = { phase: finishing ? 'stopping' : browser.phase,
      message: browser.phase === 'error' ? browser.message : finishing ? 'Finishing speaker estimates…' : this.notice ?? browser.message,
      ...(this.notice && browser.phase !== 'error' ? { notice: this.notice } : {}), segments };
    this.listeners.forEach((listener) => listener());
  }
  start(language: string) {
    if (active(this.snapshot)) return;
    this.connect(); this.starting = true;
    this.history = [...this.snapshot.segments]; this.browser.clear(); this.local.clear();
    this.notice = undefined; this.running = true;
    this.namesStarted = this.local.getPreparationSnapshot().phase === 'ready' && !this.local.unavailableReason && language.startsWith('en');
    // Both activation calls stay in the user's original gesture. Browser audio
    // and results remain independent; Android/Safari coexistence needs retesting.
    if (this.namesStarted) this.local.start(language);
    else this.notice = language.startsWith('en') ? 'Browser captions are active. Prepare speaker estimates in Settings to add names.'
      : 'Speaker estimates currently support English only. Browser captions continue in the selected language.';
    this.browser.start(language); this.starting = false; this.update();
  }
  stop() { this.local.stop(); this.browser.stop(); this.update(); }
  interrupt() { this.running = false; this.local.interrupt(); this.browser.interrupt(); this.update(); }
  clear() {
    if (active(this.snapshot)) return;
    this.starting = true; this.history = []; this.namesStarted = false; this.notice = undefined;
    this.local.clear(); this.browser.clear(); this.starting = false; this.update();
  }
  dispose() {
    this.unwatch.splice(0).forEach((unsubscribe) => unsubscribe());
    this.running = false; this.namesStarted = false; this.history = []; this.notice = undefined;
    this.local.dispose(); this.browser.dispose(); this.snapshot = this.browser.getSnapshot(); this.listeners.clear();
  }
}
