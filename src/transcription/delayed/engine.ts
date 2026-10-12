import type { TranscriptionEngine, TranscriptionSnapshot, TranscriptSegment } from '../types';
import type { LocalListeningEngine } from '../local/types';
import { delayedNames } from './align';
import type { ProfileStore } from '../../storage/profiles';
import { watchProfileChanges } from '../../storage/profile-changes';
import { speakerModel } from '../../identification/model';

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
  private hasSpeakers: boolean;
  private profileGeneration = 0;
  private profileError: string | undefined;
  private namesAttempted = false;
  private language = 'en-GB';
  constructor(private readonly browser: TranscriptionEngine, private readonly local: LocalListeningEngine,
    private readonly profiles?: { database: string; createStore(): ProfileStore }) {
    this.snapshot = browser.getSnapshot();
    this.hasSpeakers = !profiles;
  }
  get unavailableReason() { return this.browser.unavailableReason; }
  getSnapshot = () => this.snapshot;
  getPreparationSnapshot = () => this.local.getPreparationSnapshot();
  private connect() {
    if (this.unwatch.length) return;
    this.unwatch = [this.browser.subscribe(() => this.update()), this.local.subscribe(() => this.update())];
    if (this.profiles) {
      this.unwatch.push(watchProfileChanges(this.profiles.database, () => void this.refreshProfiles()));
      void this.refreshProfiles();
    }
  }
  private async refreshProfiles() {
    if (!this.profiles) return;
    const generation = ++this.profileGeneration;
    const store = this.profiles.createStore();
    try {
      const profiles = await store.list();
      if (generation !== this.profileGeneration) return;
      this.hasSpeakers = profiles.some((profile) => profile.modelVersion === speakerModel.version);
      this.profileError = profiles.length && !this.hasSpeakers ? 'Record a new voice profile to show names.' : undefined;
      if (this.hasSpeakers) void this.prepare();
      else {
        this.namesStarted = false;
        this.local.interrupt(); this.local.cancelPreparation();
      }
      this.update();
    } catch {
      if (generation === this.profileGeneration) {
        this.profileError = 'Speaker storage unavailable. Live captions still work.';
        this.hasSpeakers = false; this.namesStarted = false;
        this.local.interrupt(); this.local.cancelPreparation(); this.update();
      }
    } finally { store.close(); }
  }
  private startNamesIfReady() {
    if (!this.running || this.namesAttempted || !this.hasSpeakers || !this.language.startsWith('en')
      || this.local.getPreparationSnapshot().phase !== 'ready' || this.local.unavailableReason) return;
    this.namesAttempted = true; this.namesStarted = true; this.notice = undefined;
    this.local.start(this.language);
  }
  subscribe = (listener: () => void) => {
    this.connect(); this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  };
  prepare = async (cachedOnly = false) => { this.connect(); await this.local.prepare(cachedOnly); };
  cancelPreparation = () => this.local.cancelPreparation();
  private update() {
    if (this.starting) return;
    const browser = this.browser.getSnapshot();
    // A completed background preparation may join the current browser session.
    // Stop/error must win before any late microphone activation.
    if (this.profiles && !this.namesAttempted && this.local.getPreparationSnapshot().phase === 'ready'
      && active(browser) && browser.phase !== 'stopping') queueMicrotask(() => {
        const current = this.browser.getSnapshot();
        if (active(current) && current.phase !== 'stopping') this.startNamesIfReady();
      });
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
    const preparation = this.local.getPreparationSnapshot();
    const notice = this.notice ?? this.profileError ?? (this.profiles && this.hasSpeakers && !this.namesStarted && active(browser)
      ? !this.language.startsWith('en') ? 'Names currently support English.'
        : preparation.phase === 'error' ? 'Names unavailable. Retry in Settings.'
          : preparation.phase === 'ready' && this.local.unavailableReason ? 'Names unavailable on this browser.' : 'Preparing names…' : undefined);
    this.snapshot = { phase: finishing ? 'stopping' : browser.phase,
      message: browser.phase === 'error' ? browser.message : finishing ? 'Finishing speaker estimates…' : notice ?? browser.message,
      ...(notice && browser.phase !== 'error' ? { notice } : {}), segments };
    this.listeners.forEach((listener) => listener());
  }
  start(language: string) {
    if (active(this.snapshot)) return;
    this.connect(); this.starting = true;
    this.history = [...this.snapshot.segments]; this.browser.clear(); this.local.clear();
    this.notice = undefined; this.running = true; this.language = language; this.namesStarted = false; this.namesAttempted = false;
    // Both activation calls stay in the user's original gesture. Browser audio
    // and results remain independent; Android/Safari coexistence needs retesting.
    this.startNamesIfReady();
    if (this.profiles && this.hasSpeakers && !this.namesStarted) void this.prepare();
    this.browser.start(language); this.starting = false; this.update();
  }
  stop() { this.running = false; this.local.stop(); this.browser.stop(); this.update(); }
  interrupt() { this.running = false; this.local.interrupt(); this.browser.interrupt(); this.update(); }
  clear() {
    if (active(this.snapshot)) return;
    this.starting = true; this.history = []; this.namesStarted = false; this.notice = undefined;
    this.local.clear(); this.browser.clear(); this.starting = false; this.update();
  }
  dispose() {
    this.profileGeneration++; this.hasSpeakers = !this.profiles; this.profileError = undefined;
    this.unwatch.splice(0).forEach((unsubscribe) => unsubscribe());
    this.running = false; this.namesStarted = false; this.history = []; this.notice = undefined;
    this.local.dispose(); this.browser.dispose(); this.snapshot = this.browser.getSnapshot(); this.listeners.clear();
  }
}
