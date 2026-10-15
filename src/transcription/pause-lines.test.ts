import { expect, it } from 'vitest';
import { PauseLines } from './pause-lines';

it('preserves every character across successive pause hints and growing phrases', () => {
  const lines = new PauseLines();
  const segment = { id: '1:0', sessionId: 4, revision: 2, text: 'First.', isFinal: false };
  lines.mark(segment); lines.mark({ ...segment, text: 'First. Second.' });
  const text = 'First. Second. Third.';
  const result = lines.apply([{ ...segment, text }]);
  expect(result.map((s) => s.text.trim())).toEqual(['First.', 'Second.', 'Third.']);
  expect(result.map((s) => s.text).join('')).toBe(text);
  expect(new Set(result.map((s) => s.id)).size).toBe(3);
  expect(result.every((s) => s.sessionId === 4 && !s.isFinal)).toBe(true);
});
it('keeps a revised prefix complete instead of guessing where to split its words', () => {
  const lines = new PauseLines();
  lines.mark({ id: 'a', text: 'We are hear.', isFinal: false });
  const corrected = { id: 'a', text: 'We are here. A new sentence.', isFinal: true };
  expect(lines.apply([corrected])).toEqual([corrected]);
  lines.clear(); expect(lines.apply([corrected])).toEqual([corrected]);
});

it('keeps late closing punctuation on the earlier line without creating duplicate cuts', () => {
  const lines = new PauseLines();
  const segment = { id: 'a', text: 'First', isFinal: false };
  lines.mark(segment); lines.mark({ ...segment, text: 'First.' });
  const text = 'First. Next phrase.';
  const result = lines.apply([{ ...segment, text }]);
  expect(result.map((s) => s.text)).toEqual(['First.', ' Next phrase.']);
  expect(result.map((s) => s.text).join('')).toBe(text);
  const partial = new PauseLines(); partial.mark({ ...segment, text: 'No' });
  expect(partial.apply([{ ...segment, text: 'Nobody spoke.' }])).toHaveLength(1);
});
