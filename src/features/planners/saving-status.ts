export type SavingState = {
  pending: number; saving: boolean; durable: boolean; conflict: boolean;
  confirmed: boolean; error: boolean; drafts: number; draftsDurable: boolean;
};

export function savingStatus(state: SavingState, offline: boolean, needsConnection: boolean) {
  if (!state.draftsDurable) return { tone: 'warning', text: 'Draft could not be kept on this device. Keep the app open.' };
  if (!state.durable) return { tone: 'warning', text: state.error
    ? 'Changes are only in this open app. Keep it open until saved.' : 'Keeping changes on this device...' };
  if (state.conflict) return { tone: 'warning', text: 'A family change needs your attention' };
  if (state.saving) return { tone: 'pending', text: 'Sharing changes with your family...' };
  if (state.pending) return { tone: 'pending', text: needsConnection
    ? 'Saved on this device — reconnect in Settings to share'
    : 'Saved on this device — waiting to share' };
  if (state.drafts) return { tone: 'pending', text: '' };
  if (offline || state.error) return { tone: 'pending', text: 'Waiting to check for family changes' };
  // Cached data or an empty queue alone cannot establish a successful sync.
  return { tone: 'saved', text: state.confirmed ? 'Saved' : '' };
}
