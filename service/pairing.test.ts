import { afterEach, expect, it, vi } from 'vitest';
import { pairingCode } from './pairing';

afterEach(() => vi.restoreAllMocks());

it('preserves six digits including zero and rejects biased random values', () => {
  const values = [4294967295, 4294000000, 0, 4293999999, 1234];
  const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => {
    (array as Uint32Array)[0] = values.shift()!;
    return array;
  });
  expect(pairingCode()).toBe('000000');
  expect(pairingCode()).toBe('999999');
  expect(pairingCode()).toBe('001234');
  expect(random).toHaveBeenCalledTimes(5);
});
