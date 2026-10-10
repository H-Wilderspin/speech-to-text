// Shared by the Node and browser experiments. Never returns/logs raw input audio.
export async function createExtractor(module, model) {
  module.FS.writeFile('/embedding.onnx', model);
  const allocateString = (text) => {
    const size = module.lengthBytesUTF8(text) + 1;
    const pointer = module._malloc(size);
    if (!pointer) throw new Error('Could not allocate model configuration.');
    module.stringToUTF8(text, pointer, size);
    return pointer;
  };
  const modelPointer = allocateString('/embedding.onnx');
  const providerPointer = allocateString('cpu');
  const config = module._malloc(16);
  if (!config) throw new Error('Could not allocate extractor configuration.');
  let extractor;
  try {
    module.HEAPU32.set([modelPointer, 1, 0, providerPointer], config / 4);
    extractor = module._SherpaOnnxCreateSpeakerEmbeddingExtractor(config);
  } finally {
    module._free(config); module._free(modelPointer); module._free(providerPointer);
    module.FS.unlink('/embedding.onnx');
  }
  if (!extractor) throw new Error('The speaker model could not be loaded.');
  const dimension = module._SherpaOnnxSpeakerEmbeddingExtractorDim(extractor);
  if (!Number.isInteger(dimension) || dimension <= 0 || dimension > 4096) {
    module._SherpaOnnxDestroySpeakerEmbeddingExtractor(extractor);
    throw new Error('The model returned an invalid embedding dimension.');
  }
  return {
    dimension,
    compute(samples, sampleRate = 16000) {
      if (!extractor) throw new Error('Extractor is closed.');
      if (!(samples instanceof Float32Array) || !samples.length || samples.length > 16000 * 30
        || sampleRate !== 16000 || !samples.every(Number.isFinite)) throw new Error('Expected up to 30 seconds of finite, mono 16 kHz audio.');
      const stream = module._SherpaOnnxSpeakerEmbeddingExtractorCreateStream(extractor);
      if (!stream) throw new Error('Could not create an embedding stream.');
      let audioPointer = 0; let embeddingPointer = 0;
      try {
        audioPointer = module._malloc(samples.byteLength);
        if (!audioPointer) throw new Error('Could not allocate audio input.');
        module.HEAPF32.set(samples, audioPointer / 4);
        module._SherpaOnnxOnlineStreamAcceptWaveform(stream, sampleRate, audioPointer, samples.length);
        module.HEAPF32.fill(0, audioPointer / 4, (audioPointer + samples.byteLength) / 4);
        module._free(audioPointer); audioPointer = 0;
        module._SherpaOnnxOnlineStreamInputFinished(stream);
        if (!module._SherpaOnnxSpeakerEmbeddingExtractorIsReady(extractor, stream)) throw new Error('Too little audio for an embedding.');
        embeddingPointer = module._SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding(extractor, stream);
        if (!embeddingPointer) throw new Error('Embedding inference failed.');
        const embedding = module.HEAPF32.slice(embeddingPointer / 4, embeddingPointer / 4 + dimension);
        if (!embedding.every(Number.isFinite)) throw new Error('Model returned non-finite values.');
        return embedding;
      } finally {
        if (audioPointer) { module.HEAPF32.fill(0, audioPointer / 4, (audioPointer + samples.byteLength) / 4); module._free(audioPointer); }
        if (embeddingPointer) module._SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding(embeddingPointer);
        module._SherpaOnnxDestroyOnlineStream(stream);
      }
    },
    close() {
      if (extractor) module._SherpaOnnxDestroySpeakerEmbeddingExtractor(extractor);
      extractor = 0;
    },
  };
}

export function syntheticAudio(seconds = 3) {
  // Deterministic multi-frequency signal: runtime smoke test, not a human voice.
  return Float32Array.from({ length: seconds * 16000 }, (_, index) => {
    const t = index / 16000;
    return .12 * (Math.sin(2 * Math.PI * 173 * t) + .5 * Math.sin(2 * Math.PI * 347 * t)) * (.6 + .4 * Math.sin(2 * Math.PI * 3 * t));
  });
}
