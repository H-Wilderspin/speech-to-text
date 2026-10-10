export const syntheticPhrase = 'The morning is bright and the room is quiet. Please bring a glass of water to the table.';

/** Aggregate edit distance only. Never return the recognized words in a report. */
export function wordErrors(reference, hypothesis) {
  const words = (text) => text.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const expected = words(reference); const actual = words(hypothesis);
  let previous = Array.from({ length: actual.length + 1 }, (_, i) => i);
  for (let i = 1; i <= expected.length; i++) {
    const current = [i];
    for (let j = 1; j <= actual.length; j++) current[j] = Math.min(previous[j] + 1, current[j - 1] + 1,
      previous[j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1));
    previous = current;
  }
  return { referenceWords: expected.length, recognizedWords: actual.length, edits: previous[actual.length],
    errorRate: expected.length ? previous[actual.length] / expected.length : null };
}
