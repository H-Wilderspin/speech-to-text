import { expect, it } from 'vitest';
import { readableLocalCaptions } from './readable-text';

it('uses readable casing across speaker groups without altering words or speaker metadata', () => {
  const input = [{ id: '0', text: 'I THINK', isFinal: true },
    { id: '1', text: "I'M READY AND I CAN HEAR YOU", isFinal: true, speakerId: 'a', speakerName: 'McTest', speakerEstimated: true }];
  const result = readableLocalCaptions(input);
  expect(result.map((segment) => segment.text)).toEqual(['I think', "I'm ready and I can hear you"]);
  expect(result[1]).toMatchObject({ speakerId: 'a', speakerName: 'McTest', speakerEstimated: true });
  expect(input[1]!.text).toBe("I'M READY AND I CAN HEAR YOU");
});

it('keeps punctuation and formats both anonymous interim and completed captions', () => {
  for (const isFinal of [false, true]) {
    expect(readableLocalCaptions([{ id: '0', text: 'HELLO THERE. ARE YOU READY? YES!', isFinal }])[0]).toEqual({ id: '0', text: 'Hello there. Are you ready? Yes!', isFinal });
  }
  expect(readableLocalCaptions([{ id: '0', text: '123 APPLES AND FIVE PEARS', isFinal: true }])[0]!.text).toBe('123 apples and five pears');
});

it('preserves already mixed-case output and never invents punctuation', () => {
  const input = [{ id: '0', text: 'Hello NASA and iPhone', isFinal: true }];
  expect(readableLocalCaptions(input)).toEqual(input);
  expect(readableLocalCaptions([{ id: '0', text: 'HELLO WORLD', isFinal: false }])[0]!.text).toBe('Hello world');
});
