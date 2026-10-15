import type { TranscriptSegment, TranscriptionEngine } from '../types';
import type { AudioFrame } from '../../audio/streaming';
import type { DiagnosticCounts } from '../diagnostics';

export interface ReferenceVoice { id: string; name: string; embedding: number[] }
export interface TokenPoint { text: string; sample: number }
export interface PipelineResult {
  text: string; isFinal: boolean; tokenPoints: TokenPoint[]; clockId: string;
  timing: { segment: number }; acceptedSamples: number;
}
export interface VoiceWindow {
  clockId: string; startSample: number; endSample: number; speakerId?: string;
  match?: { candidates: number; bestScore: number | null };
}
export interface EmbeddingWindow extends Omit<VoiceWindow, 'speakerId' | 'match'> { embedding: Float32Array }
export interface Pipeline {
  accept(frame: AudioFrame): PipelineResult;
  finish(): PipelineResult;
  reset(): void;
  close(): void;
}
export interface LocalResponse { id: number; sessionId?: number; error?: string; segments?: TranscriptSegment[]; commandStop?: boolean; speakerStatus?: string; diagnostics?: DiagnosticCounts }
export interface PreparationSnapshot { phase: 'idle' | 'preparing' | 'ready' | 'error'; message: string }
export interface LocalListeningEngine extends TranscriptionEngine {
  resetSession?(sessionId: number): Promise<void>;
  getPreparationSnapshot(): PreparationSnapshot;
  prepare(cachedOnly?: boolean): Promise<void>;
  cancelPreparation(): void;
}
