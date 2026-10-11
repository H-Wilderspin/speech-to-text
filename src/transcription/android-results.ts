import type { RecognitionResults, TranscriptSegment } from './types';

export function usesAndroidRecognition(userAgent: string): boolean {
  return /Android/i.test(userAgent) && /(?:Chrome|Chromium)\//.test(userAgent);
}

/**
 * Chromium's Android bridge promotes partial callbacks to final in continuous
 * mode, appending each revision as a new Web Speech slot. Android onResults ends
 * that native session. Within it, display the latest hypothesis in one slot and
 * keep it provisional until normal native end. Neither the promoted final flag
 * nor a confidence score reliably distinguishes these revisions from completion.
 */
export function reconcileAndroidResults(results: RecognitionResults, sessionId: number): TranscriptSegment[] {
  const result = results[results.length - 1];
  const alternative = result?.[0];
  const text = alternative?.transcript.trim();
  return text ? [{ id: `${sessionId}:0`, text, isFinal: false }] : [];
}
