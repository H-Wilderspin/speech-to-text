export type Preferences = { textSize: number; language: string };
const defaults: Preferences = { textSize: 32, language: 'en-GB' };
const key = () => `speech-to-text-display:${new URL(import.meta.env.BASE_URL, document.baseURI).pathname}`;
export function readPreferences(): Preferences {
  try {
    const data = JSON.parse(localStorage.getItem(key()) ?? 'null');
    if (!data || typeof data !== 'object') return defaults;
    return {
      textSize: Number.isInteger(data.textSize) && data.textSize >= 28 && data.textSize <= 56 ? data.textSize : 32,
      language: ['en-GB', 'en-US', 'fr-FR', 'de-DE', 'es-ES'].includes(data.language) ? data.language : 'en-GB',
    };
  } catch { return defaults; }
}
export function savePreferences(value: Preferences) {
  try { localStorage.setItem(key(), JSON.stringify(value)); } catch { /* Keep working for this session. */ }
}
