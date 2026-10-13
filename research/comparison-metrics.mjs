export const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').trim().split(/\s+/).filter(Boolean);

/** Conservative shared-clock join. Every point/whole interval must be covered by
 * one cluster, with no gaps or other active clusters. Unknown stays unknown. */
export function timelineIdentity(word, turns, identities) {
  const end = word.end ?? word.start;
  if (!Number.isFinite(word.start) || !Number.isFinite(end) || word.start < 0 || end < word.start) throw new Error('Invalid word timing');
  const active = turns.filter((turn) => end === word.start
    ? turn.start <= word.start && turn.end > word.start
    : turn.start < end && turn.end > word.start);
  const clusters = new Set(active.map((turn) => turn.cluster));
  if (clusters.size !== 1) return undefined;
  const id = identities[active[0].cluster];
  if (!id) return undefined;
  let through = word.start;
  for (const turn of active.toSorted((a, b) => a.start - b.start)) {
    if (turn.start > through) return undefined;
    through = Math.max(through, turn.end);
  }
  return through >= end ? id : undefined;
}

/** Levenshtein alignment measures recognized AND correctly attributed words.
 * Repeated words consume distinct positions; omissions cannot inflate coverage. */
export function scoreWords(reference, hypothesis) {
  const expected = reference.flatMap((word) => normalize(word.text).map((text) => ({ ...word, text })));
  const actual = hypothesis.flatMap((word) => normalize(word.text).map((text) => ({ ...word, text })));
  const dp = Array.from({ length: expected.length + 1 }, () => Array(actual.length + 1).fill(0));
  for (let i = 0; i <= expected.length; i++) dp[i][0] = i;
  for (let j = 0; j <= actual.length; j++) dp[0][j] = j;
  for (let i = 1; i <= expected.length; i++) for (let j = 1; j <= actual.length; j++) dp[i][j] = Math.min(
    dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (expected[i - 1].text === actual[j - 1].text ? 0 : 1));
  let i = expected.length; let j = actual.length;
  const matches = new Map(); const pairs = [];
  while (i || j) {
    if (i && j && dp[i][j] === dp[i - 1][j - 1] + (expected[i - 1].text === actual[j - 1].text ? 0 : 1)) {
      pairs.push([i - 1, j - 1]);
      if (expected[i - 1].text === actual[j - 1].text) matches.set(i - 1, j - 1);
      i--; j--;
    } else if (i && dp[i][j] === dp[i - 1][j] + 1) i--;
    else j--;
  }
  const known = expected.map((w, index) => w.speakerId ? index : -1).filter((index) => index >= 0);
  const correct = (index) => matches.has(index) && actual[matches.get(index)].speakerId === expected[index].speakerId;
  const utterances = [...new Set(known.map((index) => expected[index].utterance))];
  return {
    referenceWords: expected.length, recognizedWords: actual.length, edits: dp[expected.length][actual.length],
    knownWords: known.length, correctlyNamedWords: known.filter(correct).length,
    namedWords: actual.filter((w) => w.speakerId).length,
    wrongNamesOnAlignedWords: pairs.filter(([a, b]) => actual[b].speakerId && actual[b].speakerId !== expected[a].speakerId).length,
    unknownReferenceWords: expected.filter((w) => !w.speakerId).length,
    falseNamesOnUnknownAlignedWords: pairs.filter(([a, b]) => !expected[a].speakerId && actual[b].speakerId).length,
    unalignedNamedInsertions: actual.filter((w, index) => w.speakerId && !pairs.some(([, b]) => b === index)).length,
    knownUtterances: utterances.length,
    completeCorrectKnownUtterances: utterances.filter((id) => known.filter((index) => expected[index].utterance === id).every(correct)).length,
    correctOpeningWords: utterances.filter((id) => correct(known.find((index) => expected[index].utterance === id))).length,
    correctClosingWords: utterances.filter((id) => correct(known.findLast((index) => expected[index].utterance === id))).length,
  };
}
