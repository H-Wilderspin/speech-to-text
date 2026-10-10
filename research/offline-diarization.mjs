// Research only. ABI: sherpa-onnx 9db1af1, wasm32, 56-byte config / 16-byte segment.
// Each process() call has its own anonymous cluster namespace, never a known identity.
export function createDiarizer(module, segmentation, embedding, numClusters = -1) {
  if (!Number.isInteger(numClusters) || (numClusters !== -1 && (numClusters < 1 || numClusters > 3))) throw new Error('Invalid research cluster count.');
  const allocations = []; const paths = []; let handle = 0;
  const allocate = (size) => {
    const pointer = module._malloc(size);
    if (!pointer) throw new Error('Diarization allocation failed.');
    allocations.push(pointer); return pointer;
  };
  const string = (value) => {
    const size = module.lengthBytesUTF8(value) + 1; const pointer = allocate(size);
    module.stringToUTF8(value, pointer, size); return pointer;
  };
  try {
    for (const [path, bytes] of [['/segmentation.onnx', segmentation], ['/embedding.onnx', embedding]]) {
      module.FS.writeFile(path, bytes); paths.push(path);
    }
    const segmentationPath = string(paths[0]); const embeddingPath = string(paths[1]); const provider = string('cpu');
    const config = allocate(56); const index = config / 4;
    module.HEAPU8.fill(0, config, config + 56);
    module.HEAPU32.set([segmentationPath, 0, 1, 0, provider, embeddingPath, 1, 0, provider, numClusters >>> 0, 0, 0, 0, 0], index);
    module.HEAPF32[index + 1] = 0.1; // Ten-second segmentation, one-second shift.
    module.HEAPF32[index + 10] = 0.5; // Upstream distance threshold; NOT calibrated identity acceptance.
    module.HEAPF32[index + 12] = 0.2;
    module.HEAPF32[index + 13] = 0.5;
    handle = module._SherpaOnnxCreateOfflineSpeakerDiarization(config);
    if (!handle) throw new Error('Could not initialize diarization models.');
    if (module._SherpaOnnxOfflineSpeakerDiarizationGetSampleRate(handle) !== 16000) throw new Error('Expected a 16 kHz diarization model.');
  } catch (error) {
    if (handle) module._SherpaOnnxDestroyOfflineSpeakerDiarization(handle);
    throw error;
  } finally {
    for (const pointer of allocations) module._free(pointer);
    for (const path of paths) module.FS.unlink(path);
  }
  return {
    process(samples) {
      if (!handle) throw new Error('Diarizer is closed.');
      if (!(samples instanceof Float32Array) || !samples.length || samples.length > 30 * 16000 || !samples.every(Number.isFinite)) throw new Error('Expected up to 30 seconds of finite mono 16 kHz samples.');
      let pointer = 0; let result = 0; let segments = 0;
      try {
        pointer = module._malloc(samples.byteLength);
        if (!pointer) throw new Error('Could not allocate diarization audio.');
        module.HEAPF32.set(samples, pointer / 4);
        result = module._SherpaOnnxOfflineSpeakerDiarizationProcess(handle, pointer, samples.length);
        if (!result) throw new Error('Diarization inference failed.');
        const count = module._SherpaOnnxOfflineSpeakerDiarizationResultGetNumSegments(result);
        const speakers = module._SherpaOnnxOfflineSpeakerDiarizationResultGetNumSpeakers(result);
        if (!Number.isInteger(count) || count < 0 || count > 3000 || !Number.isInteger(speakers) || speakers < 0 || speakers > 3000) throw new Error('Invalid diarization result size.');
        segments = module._SherpaOnnxOfflineSpeakerDiarizationResultSortByStartTime(result);
        if (count && !segments) throw new Error('Missing diarization segments.');
        const output = [];
        for (let i = 0; i < count; i++) {
          const index = segments / 4 + i * 4;
          const start = module.HEAPF32[index]; const end = module.HEAPF32[index + 1]; const cluster = module.HEAPU32[index + 2];
          if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > samples.length / 16000 || cluster >= 3000
            || (i && start < output[i - 1].start)) throw new Error('Invalid diarization segment.');
          output.push({ start, end, cluster }); // No silhouette score is treated as identity confidence.
        }
        if (new Set(output.map(({ cluster }) => cluster)).size !== speakers) throw new Error('Inconsistent diarization speaker count.');
        return { speakers, segments: output };
      } finally {
        if (pointer) { module.HEAPF32.fill(0, pointer / 4, (pointer + samples.byteLength) / 4); module._free(pointer); }
        if (segments) module._SherpaOnnxOfflineSpeakerDiarizationDestroySegment(segments);
        if (result) module._SherpaOnnxOfflineSpeakerDiarizationDestroyResult(result);
      }
    },
    close() { if (handle) module._SherpaOnnxDestroyOfflineSpeakerDiarization(handle); handle = 0; },
  };
}
