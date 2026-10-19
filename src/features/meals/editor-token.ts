export type MealAccess = { token: string; remembered: boolean; notice: string };

// Namespace cleanup by app path; localStorage itself is shared by the origin.
export const editorTokenKey = () => `speech-to-text-meal-editor:${new URL(import.meta.env.BASE_URL, document.baseURI).pathname}`;

export function readMealAccess(): MealAccess {
  try {
    const token = localStorage.getItem(editorTokenKey())?.trim() ?? '';
    return { token, remembered: Boolean(token), notice: '' };
  } catch {
    return { token: '', remembered: false, notice: '' };
  }
}

// Call only after verifying a new token. Never save credentials as a side effect
// of mounting, rendering or restoring a tab's state.
export function changeMealAccess(token: string, remember = false): MealAccess {
  const remembered = Boolean(token) && remember;
  try {
    if (remembered) localStorage.setItem(editorTokenKey(), token);
    else localStorage.removeItem(editorTokenKey());
    return { token, remembered, notice: '' };
  } catch {
    return { token, remembered: false, notice: remembered
      ? 'Connected for this session only. This browser could not remember access.'
      : 'Saved access could not be removed. Clear this site’s browser data or revoke the saved token in GitHub before reopening the app.' };
  }
}
