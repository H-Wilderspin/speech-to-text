import { expect, it } from 'vitest';
import { wordErrors } from './word-errors.mjs';
it('reports aggregate word edits across insertions, deletions and substitutions', () => {
  expect(wordErrors('A blue sky.', 'a blue sky')).toMatchObject({ edits: 0, errorRate: 0 });
  expect(wordErrors('a blue sky', 'a green blue sky')).toMatchObject({ edits: 1, recognizedWords: 4 });
  expect(wordErrors('a blue sky', 'blue')).toMatchObject({ edits: 2, referenceWords: 3 });
  expect(wordErrors('a blue sky', 'the red sky')).toMatchObject({ edits: 2 });
  expect(wordErrors('', 'extra')).toMatchObject({ edits: 1, errorRate: null });
});
