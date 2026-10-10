import { speakerModel } from './model';

export interface NativeModule {
  FS: { writeFile(path: string, data: Uint8Array): void; unlink(path: string): void };
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  lengthBytesUTF8(text: string): number;
  stringToUTF8(text: string, pointer: number, size: number): void;
  _SherpaOnnxCreateSpeakerEmbeddingExtractor(config: number): number;
  _SherpaOnnxDestroySpeakerEmbeddingExtractor(extractor: number): void;
  _SherpaOnnxSpeakerEmbeddingExtractorDim(extractor: number): number;
  _SherpaOnnxSpeakerEmbeddingExtractorCreateStream(extractor: number): number;
  _SherpaOnnxSpeakerEmbeddingExtractorIsReady(extractor: number, stream: number): number;
  _SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding(extractor: number, stream: number): number;
  _SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding(embedding: number): void;
  _SherpaOnnxOnlineStreamAcceptWaveform(stream: number, rate: number, samples: number, length: number): void;
  _SherpaOnnxOnlineStreamInputFinished(stream: number): void;
  _SherpaOnnxDestroyOnlineStream(stream: number): void;
}

export function createNativeExtractor(module: NativeModule, model: Uint8Array) {
  const pointers: number[] = [];
  const allocate = (size: number) => {
    const pointer = module._malloc(size);
    if (!pointer) throw new Error('Not enough memory for the voice model.');
    pointers.push(pointer); return pointer;
  };
  const string = (value: string) => {
    const size = module.lengthBytesUTF8(value) + 1;
    const pointer = allocate(size); module.stringToUTF8(value, pointer, size); return pointer;
  };
  let extractor = 0;
  module.FS.writeFile('/embedding.onnx', model);
  try {
    const path = string('/embedding.onnx'); const provider = string('cpu'); const config = allocate(16);
    // SherpaOnnxSpeakerEmbeddingExtractorConfig: model pointer, threads, debug, provider pointer.
    module.HEAPU32.set([path, 1, 0, provider], config / 4);
    extractor = module._SherpaOnnxCreateSpeakerEmbeddingExtractor(config);
  } finally { pointers.forEach((pointer) => module._free(pointer)); module.FS.unlink('/embedding.onnx'); }
  if (!extractor) throw new Error('Could not open the voice model.');
  if (module._SherpaOnnxSpeakerEmbeddingExtractorDim(extractor) !== speakerModel.dimension) {
    module._SherpaOnnxDestroySpeakerEmbeddingExtractor(extractor);
    throw new Error('The voice model is incompatible.');
  }
  return {
    compute(samples: Float32Array): Float32Array {
      if (!extractor || samples.length < 48000 || samples.length > 480000 || !samples.every(Number.isFinite)) {
        throw new Error('The recording is invalid.');
      }
      const stream = module._SherpaOnnxSpeakerEmbeddingExtractorCreateStream(extractor);
      if (!stream) throw new Error('Could not start voice processing.');
      let audio = 0; let output = 0;
      try {
        audio = module._malloc(samples.byteLength);
        if (!audio) throw new Error('Not enough memory for the recording.');
        module.HEAPF32.set(samples, audio / 4);
        module._SherpaOnnxOnlineStreamAcceptWaveform(stream, 16000, audio, samples.length);
        module._SherpaOnnxOnlineStreamInputFinished(stream);
        if (!module._SherpaOnnxSpeakerEmbeddingExtractorIsReady(extractor, stream)) throw new Error('Too little usable audio. Record again.');
        output = module._SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding(extractor, stream);
        if (!output) throw new Error('Could not compute the voiceprint.');
        return module.HEAPF32.slice(output / 4, output / 4 + speakerModel.dimension);
      } finally {
        if (audio) { module.HEAPF32.fill(0, audio / 4, audio / 4 + samples.length); module._free(audio); }
        if (output) { module.HEAPF32.fill(0, output / 4, output / 4 + speakerModel.dimension); module._SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding(output); }
        module._SherpaOnnxDestroyOnlineStream(stream);
      }
    },
    close() { if (extractor) module._SherpaOnnxDestroySpeakerEmbeddingExtractor(extractor); extractor = 0; },
  };
}
