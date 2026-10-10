import { describe, expect, it } from 'vitest';
import { consumeStopCommand } from './stop-command';

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
