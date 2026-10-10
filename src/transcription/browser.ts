import { reconcileResults } from './reconcile';
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
  private current: TranscriptSegment[] = [];
  private sessionId = 0;

  constructor(private factory: RecognizerFactory | null, public readonly unavailableReason: string | null = null) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(phase: TranscriptionSnapshot['phase'], message: string) {
    this.snapshot = { phase, message, segments: [...this.history, ...this.current] };
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
    const recognizer = this.detach();
    if (abort) this.abort(recognizer);
    this.history.push(...this.current.filter((segment) => segment.isFinal));
    this.current = [];
    this.publish(phase, message);
  }

  start(language: string) {
    if (this.recognizer) return;
    if (this.history.reduce((total, segment) => total + segment.text.length, 0) > MAX_SESSION_CHARACTERS) {
      this.publish('idle', 'This session is full. Clear the text before starting a new session.');
      return;
    }
    if (!this.factory || this.unavailableReason) {
      this.publish('error', this.unavailableReason ?? 'Speech recognition is not available in this browser.');
      return;
    }
    this.sessionId++;
    this.publish('requesting-permission', 'Waiting for microphone access…');
    try {
      const recognizer = this.factory();
      this.recognizer = recognizer;
      recognizer.lang = language;
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.maxAlternatives = 1;
      recognizer.onstart = () => {
        if (this.recognizer !== recognizer) { this.abort(recognizer); return; }
        if (this.snapshot.phase === 'stopping') return;
        this.cancelTimer();
        this.publish('listening', 'Listening. Speak naturally.');
      };
      recognizer.onresult = ({ results }) => {
        if (this.recognizer !== recognizer) return;
        this.current = reconcileResults(this.current, results, this.sessionId);
        this.publish(this.snapshot.phase, this.snapshot.message);
        if (this.snapshot.segments.reduce((total, segment) => total + segment.text.length, 0) > MAX_SESSION_CHARACTERS) {
          this.finish('idle', 'This session is full. Your confirmed text is still here. Clear the text before starting a new session.');
        }
      };
      recognizer.onerror = ({ error }) => {
        if (this.recognizer !== recognizer) return;
        if (this.snapshot.phase === 'stopping' && error === 'aborted') {
          this.finish('idle', 'Stopped.');
        } else {
          this.finish(error === 'no-speech' || error === 'aborted' ? 'idle' : 'error',
            errorMessages[error] ?? 'Speech recognition failed. Tap Listen to try again, or try another browser.');
        }
      };
      recognizer.onend = () => {
        if (this.recognizer !== recognizer) return;
        this.finish('idle', this.snapshot.phase === 'stopping' ? 'Stopped.' : 'Listening ended. Tap Listen to continue.', false);
      };
      this.timer = setTimeout(() => this.finish('error', 'Microphone access did not start. Check permission, then tap Listen.'), REQUEST_TIMEOUT_MS);
      recognizer.start(); // Keep this in the original user gesture (especially on mobile).
    } catch {
      this.finish('error', 'Listening could not start. Check microphone permission and speech support, then tap Listen.');
    }
  }

  stop() {
    if (!this.recognizer || this.snapshot.phase === 'stopping') return;
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
    if (this.recognizer) this.finish('idle', 'Listening paused because you left the app. Tap Listen to continue.');
  }

  clear() {
    if (this.recognizer) return;
    this.history = [];
    this.current = [];
    this.publish('idle', 'Text cleared. Ready when you are.');
  }

  dispose() {
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
  return new BrowserTranscriptionEngine(Constructor ? () => new Constructor() : null, reason);
}
