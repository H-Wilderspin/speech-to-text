// Playback schedules are exact; TTS files include pauses, so these are NOT
// hand-annotated speech boundaries or a diarization-error-rate reference.
export function diarizationFixtures(voiceA, voiceB) {
  const rate = 16000;
  const arrange = (name, placements) => {
    const length = Math.max(...placements.map(({ samples, start }) => start + samples.length)) + rate;
    const audio = new Float32Array(length);
    for (const { samples, start } of placements) {
      for (let i = 0; i < samples.length; i++) audio[start + i] += samples[i] * 0.5;
    }
    return { name, audio, playback: placements.map(({ voice, start, samples }) => ({ voice, start: start / rate, end: (start + samples.length) / rate })) };
  };
  return [
    { name: 'silence', audio: new Float32Array(12 * rate), playback: [] },
    arrange('same-voice-A-A-A', [0, 1, 2].map((i) => ({ voice: 'A', samples: voiceA, start: rate + i * (voiceA.length + rate) }))),
    arrange('alternating-A-B-A', [
      { voice: 'A', samples: voiceA, start: rate },
      { voice: 'B', samples: voiceB, start: rate * 2 + voiceA.length },
      { voice: 'A', samples: voiceA, start: rate * 3 + voiceA.length + voiceB.length },
    ]),
    arrange('overlap-A-B', [
      { voice: 'A', samples: voiceA, start: rate },
      { voice: 'B', samples: voiceB, start: rate * 5 },
    ]),
  ];
}

export function summarizePlayback(segments, playback) {
  const round = (n) => Math.round(n * 1000) / 1000;
  // Cluster duration within each playback interval. An interval can contain two
  // voices, so this does not assign a cluster to an identity or assert correctness.
  const coverage = playback.map((clip) => {
    const clusterSeconds = {};
    for (const segment of segments) {
      const duration = Math.max(0, Math.min(clip.end, segment.end) - Math.max(clip.start, segment.start));
      if (duration) clusterSeconds[segment.cluster] = (clusterSeconds[segment.cluster] ?? 0) + duration;
    }
    return { ...clip, clusterSeconds: Object.fromEntries(Object.entries(clusterSeconds).map(([k, v]) => [k, round(v)])) };
  });
  const boundaries = [...new Set(segments.flatMap(({ start, end }) => [start, end]))].sort((a, b) => a - b);
  let detectedOverlapSeconds = 0;
  for (let i = 1; i < boundaries.length; i++) {
    const midpoint = (boundaries[i] + boundaries[i - 1]) / 2;
    if (new Set(segments.filter(({ start, end }) => start <= midpoint && end > midpoint).map(({ cluster }) => cluster)).size > 1) {
      detectedOverlapSeconds += boundaries[i] - boundaries[i - 1];
    }
  }
  return { playbackCoverage: coverage, detectedOverlapSeconds: round(detectedOverlapSeconds) };
}
