import { collapseCumulativeResults, reconcileResults, type RecognizedSegment } from './reconcile';
import { findVoiceCommand } from './stop-command';
import { ClearBoundary } from './clear-boundary';
import { reconcileAndroidResults, usesAndroidRecognition } from './android-results';
import type { BrowserRecognizer, RecognizerFactory, TranscriptionEngine, TranscriptionSnapshot, TranscriptSegment } from './types';

const REQUEST_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 2_000;
const MAX_SESSION_CHARACTERS = 100_000;

const errorMessages: Record<string, string> = {
  'not-allowed': 'Microphone access was not allowed. Allow microphone access in your browser’s site settings, then tap Listen.',
  'service-not-allowed': 'Speech recognition is disabled by your browser or device. Check its speech and privacy settings, or try another supported browser.',
  'audio-capture': 'The microphone is unavailable. Check that it is connected and not in use by another app, then tap Listen.',
  network: 'The speech service could not connect. Check your connection, then tap Listen. Your confirmed text is still here.',
  'language-not-supported': 'This speech language is not available in your browser. Choose another language and tap Listen.',
  'no-speech': 'No speech was detected. Move closer to the microphone and tap Listen again.',
  aborted: 'Listening was interrupted. Tap Listen to start again.',
};

export class BrowserTranscriptionEngine implements TranscriptionEngine {
  private snapshot: TranscriptionSnapshot = { phase: 'idle', message: 'Ready when you are.', segments: [] };
  private listeners = new Set<() => void>();
  private recognizer: BrowserRecognizer | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private history: TranscriptSegment[] = [];
  private current: RecognizedSegment[] = [];
  private utterance = 0;
  private sessionId = 0;
  private listeningRequested = false;
  private language = 'en-GB';
  private restartDelay = 200;
  private commandStartSessionId = 0;
  private cycleErrored = false;
  private cleared = new ClearBoundary();
  private clearRevision = 0;

  constructor(private factory: RecognizerFactory | null, public readonly unavailableReason: string | null = null,
    private resultMode: 'standard' | 'android-cumulative' = 'standard') {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(phase: TranscriptionSnapshot['phase'], message: string) {
    // Retain a rolling window instead of stopping a long listening session.
    let excess = [...this.history, ...this.current].reduce((total, segment) => total + segment.text.length, 0) - MAX_SESSION_CHARACTERS;
    for (const segments of [this.history, this.current]) {
      while (excess > 0 && segments.length) {
        const first = segments[0]!;
        if (first.text.length <= excess) {
          excess -= first.text.length;
          segments.shift();
        } else {
          segments[0] = { ...first, text: first.text.slice(excess) };
          excess = 0;
        }
      }
    }
    this.snapshot = { phase, message, clearRevision: this.clearRevision,
      segments: this.cleared.apply([...this.history, ...collapseCumulativeResults(this.current)]) };
    this.listeners.forEach((listener) => listener());
  }

  private cancelTimer() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private detach() {
    this.cancelTimer();
    const recognizer = this.recognizer;
    this.recognizer = null;
    if (recognizer) {
      recognizer.onstart = recognizer.onend = recognizer.onerror = recognizer.onresult = null;
      recognizer.onspeechstart = null;
    }
    return recognizer;
  }

  private abort(recognizer: BrowserRecognizer | null) {
    try { recognizer?.abort(); } catch {
      // An already ended native recognizer may throw InvalidStateError on abort.
      // All callbacks are detached first; no second capture stream is owned here.
    }
  }

  private finish(phase: 'idle' | 'error', message: string, abort = true) {
    this.listeningRequested = false;
    const recognizer = this.detach();
    if (abort) this.abort(recognizer);
    this.history.push(...collapseCumulativeResults(this.current.filter((segment) => segment.isFinal)));
    this.current = [];
    this.publish(phase, message);
  }

  start(language: string) {
    if (this.listeningRequested || this.recognizer) return;
    if (!this.factory || this.unavailableReason) {
      this.publish('error', this.unavailableReason ?? 'Speech recognition is not available in this browser.');
      return;
    }
    this.listeningRequested = true;
    this.language = language;
    this.restartDelay = 200;
    this.commandStartSessionId = this.sessionId + 1;
    this.publish('requesting-permission', 'Waiting for microphone access…');
    this.begin();
  }

  private restart(abort = false) {
    const delay = this.current.length ? 0 : this.restartDelay;
    const recognizer = this.detach();
    if (abort) this.abort(recognizer);
    this.history.push(...collapseCumulativeResults(this.current.filter((segment) => segment.isFinal)));
    this.current = [];
    if (!this.listeningRequested) { this.publish('idle', 'Stopped.'); return; }
    this.publish('listening', 'Listening. Say “command stop” or tap Stop to finish.');
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.listeningRequested) this.begin();
    }, delay);
    this.restartDelay = Math.min(this.restartDelay * 2, 2_000);
  }

  private begin() {
    this.sessionId++;
    this.utterance = 0;
    this.cycleErrored = false;
    try {
      const recognizer = this.factory!();
      this.recognizer = recognizer;
      recognizer.lang = this.language;
      // Keep native capture alive across pauses. Restart only if the provider
      // ends anyway; repeated single-utterance starts leave gaps in the audio.
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.maxAlternatives = 1;
      recognizer.onspeechstart = () => {
        if (this.recognizer === recognizer) this.utterance++;
      };
      recognizer.onstart = () => {
        if (this.recognizer !== recognizer) { this.abort(recognizer); return; }
        if (this.snapshot.phase === 'stopping') return;
        this.cancelTimer();
        this.publish('listening', 'Listening. Say “command stop” or tap Stop to finish.');
      };
      recognizer.onresult = ({ results }) => {
        if (this.recognizer !== recognizer) return;
        this.current = this.resultMode === 'android-cumulative'
          ? reconcileAndroidResults(results, this.sessionId)
          : reconcileResults(this.current, results, this.sessionId, true, this.utterance);
        if (this.current.length) this.restartDelay = 200;
        if (this.handleCommands()) return;
        this.publish(this.snapshot.phase, this.snapshot.message);
      };
      recognizer.onerror = ({ error }) => {
        if (this.recognizer !== recognizer) return;
        this.cycleErrored = true;
        if (this.listeningRequested && error === 'no-speech') {
          // Normally followed by onend. Bound the wait for broken providers.
          this.cancelTimer();
          this.timer = setTimeout(() => this.restart(true), STOP_TIMEOUT_MS);
        } else if (this.snapshot.phase === 'stopping' && (error === 'aborted' || error === 'no-speech')) {
          this.finish('idle', 'Stopped.');
        } else {
          this.finish(error === 'no-speech' || error === 'aborted' ? 'idle' : 'error',
            errorMessages[error] ?? 'Speech recognition failed. Tap Listen to try again, or try another browser.');
        }
      };
      recognizer.onend = () => {
        if (this.recognizer !== recognizer) return;
        if (this.resultMode === 'android-cumulative' && !this.cycleErrored) {
          // Android ends the native session after its completed result callback.
          // Errors/interruptions must not turn a partial guess into confirmed text.
          this.current = this.current.map((segment) => ({ ...segment, isFinal: true }));
          if (this.handleCommands()) return;
        }
        if (this.listeningRequested) this.restart();
        else this.finish('idle', 'Stopped.', false);
      };
      this.timer = setTimeout(() => this.finish('error', 'Microphone access did not start. Check permission, then tap Listen.'), REQUEST_TIMEOUT_MS);
      recognizer.start(); // Keep this in the original user gesture (especially on mobile).
    } catch {
      this.finish('error', 'Listening could not start. Check microphone permission and speech support, then tap Listen.');
    }
  }

  private handleCommands(): boolean {
    // Keep processing in spoken order: Clear may be followed by more speech or
    // another command in the same result. Its boundary also prevents replay.
    while (true) {
      const visible = this.cleared.apply([...this.history, ...collapseCumulativeResults(this.current.filter((segment) => segment.isFinal))]);
      const earlierSessions = visible.filter((segment) => Number(segment.id.split(':')[0]) < this.commandStartSessionId);
      const command = findVoiceCommand(visible.slice(earlierSessions.length));
      if (!command) return false;
      if (command.action === 'clear') {
        this.cleared.advance([...earlierSessions, ...command.through]);
        this.clearRevision++;
      } else {
        this.history = [...earlierSessions, ...command.before];
        this.current = []; this.cleared.reset();
        this.finish('idle', 'Stopped by voice command.');
        return true;
      }
    }
  }

  stop() {
    this.listeningRequested = false;
    if (!this.recognizer) { this.cancelTimer(); this.publish('idle', 'Stopped.'); return; }
    if (this.snapshot.phase === 'stopping') return;
    if (this.snapshot.phase === 'requesting-permission') {
      this.finish('idle', 'Microphone request cancelled.');
      return;
    }
    this.cancelTimer();
    this.publish('stopping', 'Stopping…');
    this.timer = setTimeout(() => this.finish('idle', 'Stopped.'), STOP_TIMEOUT_MS);
    try { this.recognizer.stop(); } catch { this.finish('idle', 'Stopped.'); }
  }

  interrupt() {
    if (this.recognizer || this.listeningRequested) this.finish('idle', 'Listening paused because you left the app. Tap Listen to continue.');
  }

  clear() {
    if (this.recognizer || this.listeningRequested) {
      this.cleared.mark([...this.history, ...collapseCumulativeResults(this.current)]);
      this.publish(this.snapshot.phase, this.snapshot.message);
      return;
    }
    this.cleared.reset();
    this.history = [];
    this.current = [];
    this.publish('idle', 'Text cleared. Ready when you are.');
  }

  dispose() {
    this.clearRevision = 0;
    this.cleared.reset();
    this.listeningRequested = false;
    this.abort(this.detach());
    this.history = [];
    this.current = [];
    this.snapshot = { phase: 'idle', message: 'Ready when you are.', segments: [] };
    this.listeners.clear();
  }
}

export function createBrowserEngine(): TranscriptionEngine {
  const host = window as Window & {
    SpeechRecognition?: new () => BrowserRecognizer;
    webkitSpeechRecognition?: new () => BrowserRecognizer;
  };
  const Constructor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  const reason = !window.isSecureContext ? 'Microphone access needs HTTPS (or localhost for development). Open the secure site to listen.'
    : !Constructor ? 'This browser does not offer speech recognition. Try Safari on iPhone or Chrome on Android. Availability also depends on your device settings.' : null;
  return new BrowserTranscriptionEngine(Constructor ? () => new Constructor() : null, reason,
    usesAndroidRecognition(navigator.userAgent) ? 'android-cumulative' : 'standard');
}
