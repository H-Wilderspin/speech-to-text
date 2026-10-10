import assets from '../../speaker-assets.json';
export const speakerModel = assets;

export interface EmbeddingEngine {
  prepare(signal: AbortSignal): Promise<void>;
  compute(samples: Float32Array, signal: AbortSignal): Promise<Float32Array>;
  dispose(): void;
}
