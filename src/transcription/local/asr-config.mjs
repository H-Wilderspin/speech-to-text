export function streamingConfig() {
  return {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: { encoder: '/encoder.onnx', decoder: '/decoder.onnx', joiner: '/joiner.onnx' },
      // modelingUnit is sherpa's hotword encoder setting. Hotwords are disabled;
      // its default avoids requiring an unused SentencePiece vocabulary file.
      tokens: '/tokens.txt', numThreads: 1, provider: 'cpu', debug: 0, modelType: 'zipformer', modelingUnit: 'cjkchar', bpeVocab: '',
    },
    decodingMethod: 'greedy_search', maxActivePaths: 4, enableEndpoint: 1,
    rule1MinTrailingSilence: 2.4, rule2MinTrailingSilence: 1.2, rule3MinUtteranceLength: 20,
  };
}

/** Token points are not speech start/end boundaries. Never fabricate token end times. */
export function inspectTiming(result, samplesAccepted) {
  const times = typeof result.timestamps === 'string' ? JSON.parse(result.timestamps) : result.timestamps;
  if (!Array.isArray(times) || !Array.isArray(result.tokens) || times.length !== result.tokens.length
    || !Number.isFinite(result.start_time) || result.start_time < 0
    || !Number.isInteger(result.segment) || result.segment < 0
    || !Number.isSafeInteger(samplesAccepted) || samplesAccepted < 0) throw new Error('Recognizer supplied incompatible timing metadata.');
  const absolute = times.map((time) => result.start_time + time);
  if (!absolute.every((time, i) => typeof time === 'number' && Number.isFinite(time) && time >= 0
    // Both JSON timestamp components are rounded to two decimals by sherpa.
    && time <= samplesAccepted / 16000 + .01 && (i === 0 || time >= absolute[i - 1]))) {
    throw new Error('Recognizer token time is outside the accepted audio clock.');
  }
  return { tokenCount: times.length, segment: result.segment, startSeconds: result.start_time,
    firstTokenSeconds: absolute[0], lastTokenSeconds: absolute.at(-1) };
}
