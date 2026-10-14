import { expect, it } from 'vitest';
import { ClearBoundary } from './clear-boundary';

it('hides cleared words through revisions and only exposes the growing suffix', () => {
  const boundary = new ClearBoundary();
  boundary.mark([{ id: '1', text: 'We are', isFinal: false }]);
  expect(boundary.apply([{ id: '1', text: 'We were', isFinal: false }])).toEqual([]);
  expect(boundary.apply([{ id: '1', text: 'We were ready to go.', isFinal: true }])).toEqual([
    { id: '1', text: 'ready to go.', isFinal: true },
  ]);
  boundary.mark([{ id: '1', text: 'We were ready to go.', isFinal: true }]);
  expect(boundary.apply([{ id: '1', text: 'We were ready to go. Next.', isFinal: true }])[0]?.text).toBe('Next.');
  boundary.reset();
  expect(boundary.apply([{ id: '1', text: 'New session.', isFinal: true }])[0]?.text).toBe('New session.');
});

it('keeps the boundary when delayed names split the same browser sentence', () => {
  const boundary = new ClearBoundary();
  boundary.mark([{ id: '1', text: 'One two three', isFinal: false }]);
  const pieces = [
    { id: '1:names:0', sourceSegmentId: '1', text: 'One two ', isFinal: true },
    { id: '1:names:8', sourceSegmentId: '1', text: 'three four five.', isFinal: true, speakerId: 'a' },
  ];
  expect(boundary.apply(pieces)).toEqual([{ ...pieces[1], text: 'four five.' }]);
  expect(boundary.apply([{ id: '2', text: 'One two three', isFinal: true }])).toHaveLength(1);
});

it('handles punctuation and text without spaces without slicing characters', () => {
  const boundary = new ClearBoundary();
  boundary.mark([{ id: '1', text: 'Hello...', isFinal: false }, { id: '2', text: '猫', isFinal: false }]);
  expect(boundary.apply([{ id: '1', text: 'Hello!', isFinal: true }])).toEqual([]);
  expect(boundary.apply([{ id: '2', text: '猫と犬', isFinal: false }])[0]?.text).toBe('と犬');
  boundary.mark([{ id: '3', text: '...', isFinal: false }]);
  expect(boundary.apply([{ id: '3', text: '...', isFinal: true }])).toEqual([]);
});

it('does not leak a cleared number when attribution divides its punctuation', () => {
  const boundary = new ClearBoundary();
  boundary.mark([{ id: '1', text: '3.14', isFinal: true }]);
  expect(boundary.apply([
    { id: 'a', sourceSegmentId: '1', text: '3.', isFinal: true },
    { id: 'b', sourceSegmentId: '1', text: '14 is pi.', isFinal: true, speakerId: 'a' },
  ])).toEqual([{ id: 'b', sourceSegmentId: '1', text: 'is pi.', isFinal: true, speakerId: 'a' }]);
});
