export type SessionPhase = 'idle' | 'requesting-permission' | 'listening' | 'stopping' | 'error';

export interface TranscriptSegment {
  id: string;
  text: string;
  isFinal: boolean;
  startMs?: number;
  endMs?: number;
  speakerId?: string;
  // Set together only by an attribution engine with sufficient voice evidence.
  speakerName?: string;
  speakerEstimated?: boolean;
}

export interface TranscriptionSnapshot {
  phase: SessionPhase;
  message: string;
  segments: readonly TranscriptSegment[];
}

export interface TranscriptionEngine {
  readonly unavailableReason: string | null;
  getSnapshot(): TranscriptionSnapshot;
  subscribe(listener: () => void): () => void;
  start(language: string): void;
  stop(): void;
  interrupt(): void;
  clear(): void;
  dispose(): void;
}

// Only fields actually supplied by Web Speech; deliberately no fabricated timecodes.
export interface RecognitionResult {
  isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { transcript: string; confidence: number };
}

export interface RecognitionResults {
  readonly length: number;
  readonly [index: number]: RecognitionResult;
}

export interface BrowserRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { results: RecognitionResults }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type RecognizerFactory = () => BrowserRecognizer;
