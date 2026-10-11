import type { Pipeline, EmbeddingWindow } from './types';
export function createSharedPipeline(module: unknown, createRecognizer: unknown, assets: Record<string, Uint8Array>,
  inspectRegion?: (region: unknown) => void,
  options?: { windowGate: 'energy'; inspectEmbedding(window: EmbeddingWindow): void }): Promise<Pipeline>;
