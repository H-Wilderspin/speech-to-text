import { expect, it } from 'vitest';
import { savingStatus, type SavingState } from './saving-status';
const empty: SavingState = { pending: 0, saving: false, durable: true, conflict: false, confirmed: false, error: false, drafts: 0, draftsDurable: true };
it('does not claim a cached or never checked document is saved', () => {
  expect(savingStatus(empty, false, false).text).toBe('');
  expect(savingStatus({ ...empty, confirmed: true }, false, false).text).toBe('Saved');
  expect(savingStatus({ ...empty, confirmed: true, error: true }, false, false).text).toContain('Waiting to check');
  expect(savingStatus({ ...empty, confirmed: true }, true, false).text).toContain('Waiting to check');
});
it('distinguishes local drafts, pending edits, connection failures and conflicts', () => {
  expect(savingStatus({ ...empty, drafts: 1 }, false, false).text).toContain('tap Save');
  expect(savingStatus({ ...empty, pending: 1 }, true, false).text).toContain('waiting to share');
  expect(savingStatus({ ...empty, pending: 1 }, false, true).text).toContain('reconnect');
  expect(savingStatus({ ...empty, pending: 1, conflict: true }, false, false).text).toContain('attention');
  expect(savingStatus({ ...empty, draftsDurable: false }, false, false).text).toContain('Keep the app open');
});
