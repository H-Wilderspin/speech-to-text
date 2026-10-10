/** Experimental association at ASR token points; never invents word boundaries.
 * Each window must already have passed a separately calibrated identity test.
 * Wait for future windows before committing: otherwise a later change can reveal
 * that an apparently matching window crossed speakers. No wall-clock timestamps.
 */
export function attributeTokenPoint(token, windows, acceptedSample, finished = false) {
  if (!token.clockId || !Number.isSafeInteger(token.sample) || token.sample < 0
    || !Number.isSafeInteger(acceptedSample) || acceptedSample < token.sample) return { state: 'unknown' };
  if (!finished && acceptedSample < token.sample + 48000) return { state: 'pending' };
  const evidence = windows.filter((w) => w.clockId === token.clockId && w.startSample <= token.sample && w.endSample > token.sample);
  if (evidence.some((w) => !Number.isSafeInteger(w.startSample) || !Number.isSafeInteger(w.endSample)
    || w.startSample < 0 || w.endSample - w.startSample !== 48000 || w.endSample > acceptedSample)) return { state: 'unknown' };
  const independentStarts = new Set(evidence.map((w) => w.startSample));
  const id = evidence[0]?.speakerId;
  return independentStarts.size >= 2 && id && evidence.every((w) => w.speakerId === id)
    ? { state: 'matched', speakerId: id } : { state: 'unknown' };
}
