import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Caption } from '../listening/Transcript';
import { speakerColour, speakerColours, unknownColour } from './colours';

describe('speaker presentation', () => {
  it('keeps a name and its speech in the same stable colour, including interim words', () => {
    for (const isFinal of [false, true]) {
      const html = renderToStaticMarkup(createElement(Caption, { segment: { id: 'one', text: 'Example speech.', isFinal, speakerId: 'voice-a', speakerName: 'Example name' } }));
      expect(html).toContain(`color:${speakerColour('voice-a')}`);
      expect(html).toContain('Example name');
      expect(html).toContain('Example speech.');
    }
    expect(speakerColour('voice-a')).not.toEqual(speakerColour('voice-b'));
  });
  it('does not turn incomplete identity metadata into an identified person', () => {
    for (const identity of [{}, { speakerName: 'Unverified name' }, { speakerId: 'missing-name' }]) {
      const html = renderToStaticMarkup(createElement(Caption, { segment: { id: 'one', text: 'Example.', isFinal: true, ...identity } }));
      expect(html).toContain('Unknown speaker');
      expect(html).toContain(`color:${unknownColour}`);
      expect(html).not.toContain('Unverified name');
    }
  });
  it('maintains at least 7:1 text contrast against the app background', () => {
    const luminance = (hex: string) => hex.slice(1).match(/../g)!.map((pair) => parseInt(pair, 16) / 255)
      .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i]!, 0);
    for (const colour of [...speakerColours, unknownColour]) expect((luminance(colour) + .05) / (luminance('#121619') + .05)).toBeGreaterThanOrEqual(7);
  });
});
