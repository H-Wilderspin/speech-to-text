import { describe, expect, it } from 'vitest';
import { consumeStopCommand, findVoiceCommand } from './stop-command';

const segment = (text: string, isFinal = true, id = '1:0') => ({ id, text, isFinal });

describe('spoken stop command', () => {
  it.each(['command stop', 'COMMAND STOP.', 'Command, stop!', 'command-stop'])('consumes %s', (text) => {
    expect(consumeStopCommand([segment(text)])).toEqual([]);
  });
  it('retains speech before a command split across result slots', () => {
    expect(consumeStopCommand([segment('Before. Command'), segment('stop. After.', true, '1:1')])).toEqual([segment('Before.')]);
  });
  it.each(['stop', 'command', 'command stopping', 'command stops', 'recommand stop', 'command nonstop'])('does not treat %s as the command', (text) => {
    expect(consumeStopCommand([segment(text)])).toBeNull();
  });
  it('does not act on a provisional recognition guess', () => {
    expect(consumeStopCommand([segment('command stop', false)])).toBeNull();
  });
});

describe('spoken clear command', () => {
  it.each(['command clear', 'COMMAND CLEAR.', 'Command, clear!', 'command-clear'])('recognizes %s', (text) => {
    expect(findVoiceCommand([segment(text)])).toMatchObject({ action: 'clear', before: [] });
  });
  it.each(['clear', 'command clearing', 'command clearly', 'recommand clear', 'command unclear'])('ignores %s', (text) => {
    expect(findVoiceCommand([segment(text)])).toBeNull();
  });
  it('waits for confirmed words and locates the end across result slots', () => {
    expect(findVoiceCommand([segment('command clear', false)])).toBeNull();
    expect(findVoiceCommand([segment('Before. Command'), segment('clear! After.', true, '1:1')])).toEqual({
      action: 'clear', before: [segment('Before.')],
      through: [segment('Before. Command'), segment('clear', true, '1:1')],
    });
  });
  it('selects the first command in spoken order', () => {
    expect(findVoiceCommand([segment('command clear then command stop')])?.action).toBe('clear');
    expect(findVoiceCommand([segment('command stop then command clear')])?.action).toBe('stop');
  });
});
