import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Transcript } from './Transcript';
import { assignedSegments, liveSegments } from './streams';
import { delayedNames } from '../../transcription/delayed/align';
import type { TranscriptSegment } from '../../transcription/types';
import { unknownColour } from '../speakers/colours';

describe('two caption streams', () => {
  it('shows completed speaker evidence before Android finalization, hides inactive people only above', () => {
    const original = [{ id: 'android', text: 'Please bring the blue book home tomorrow.', isFinal: false }];
    const matched = delayedNames(original, [{ ...original[0]!, id: 'local', isFinal: true, speakerId: 'one', speakerName: 'Alex', speakerEstimated: true }]);
    expect(assignedSegments(matched)).toHaveLength(1);
    expect(assignedSegments(matched, ['one'])).toEqual([]);
    const other = { id: 'other', text: 'Another person.', isFinal: true, speakerId: 'two', speakerName: 'Sam' };
    expect(assignedSegments([...matched, other], ['one'])).toEqual([other]);
    expect(liveSegments(matched)).toEqual(original);
    const top = renderToStaticMarkup(createElement(Transcript, { segments: matched, textSize: 32, assigned: true, hiddenSpeakers: ['one'] }));
    expect(top).not.toContain('Alex'); expect(top).not.toContain(original[0]!.text);
    const bottom = renderToStaticMarkup(createElement(Transcript, { segments: matched, textSize: 32, hiddenSpeakers: ['one'] }));
    expect(bottom).toContain(original[0]!.text); expect(bottom).not.toContain('Alex');
    expect(assignedSegments(matched, [])).toHaveLength(1);
  });
  it('keeps only completed assigned speech above, preserving all words below', () => {
    const segments: TranscriptSegment[] = [
      { id: 'a', text: 'Unknown words.', isFinal: true },
      { id: 'b', text: 'Incomplete identity.', speakerId: 'one', isFinal: true },
      { id: 'c', text: 'Still changing.', speakerId: 'one', speakerName: 'Alex', isFinal: false },
      { id: 'd', text: 'Assigned words.', speakerId: 'one', speakerName: 'Alex', speakerEstimated: true, isFinal: true },
    ];
    expect(assignedSegments(segments).map((segment) => segment.id)).toEqual(['d']);
    const top = renderToStaticMarkup(createElement(Transcript, { segments, textSize: 32, assigned: true, colours: { one: '#ffe08a' } }));
    expect(top).toContain('Assigned words.'); expect(top).toContain('Alex (estimate)'); expect(top).toContain('color:#ffe08a');
    expect(top).not.toContain('Unknown words.'); expect(top).not.toContain('Still changing.');
    const bottom = renderToStaticMarkup(createElement(Transcript, { segments, textSize: 32 }));
    for (const segment of segments) expect(bottom).toContain(segment.text);
    expect(bottom).not.toContain('Alex'); expect(bottom).not.toContain('Unknown speaker'); expect(bottom).toContain(`color:${unknownColour}`);
  });
  it('delayed partial attribution cannot split, recolour or rewrite the live sentence', () => {
    const browser = [{ id: 'a', text: 'Before: One two three four five six. After!', isFinal: true }];
    const names = delayedNames(browser, [{ id: 'local', text: 'one two three four five six', isFinal: true, speakerId: 'one', speakerName: 'Alex', speakerEstimated: true }]);
    expect(names.length).toBeGreaterThan(1);
    expect(liveSegments(names)).toEqual(browser);
    expect(assignedSegments(names).map((segment) => segment.text).join('')).toBe('One two three four five six. ');
    expect(liveSegments([...names, { id: 'b', text: browser[0]!.text, isFinal: true }])).toHaveLength(2);
  });
});
