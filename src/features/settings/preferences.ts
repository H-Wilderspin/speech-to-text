import { validColour, type SpeakerColourChoices } from '../speakers/colours';

export type Preferences = { textSize: number; language: string; colours: SpeakerColourChoices };
const defaults: Preferences = { textSize: 32, language: 'en-GB', colours: {} };
const key = () => `speech-to-text-display:${new URL(import.meta.env.BASE_URL, document.baseURI).pathname}`;
export function readPreferences(): Preferences {
  try {
    const data = JSON.parse(localStorage.getItem(key()) ?? 'null');
    if (!data || typeof data !== 'object') return defaults;
    return {
      textSize: Number.isInteger(data.textSize) && data.textSize >= 28 && data.textSize <= 56 ? data.textSize : 32,
      language: ['en-GB', 'en-US', 'fr-FR', 'de-DE', 'es-ES'].includes(data.language) ? data.language : 'en-GB',
      colours: Object.fromEntries(Object.entries(data.colours ?? {}).filter((entry): entry is [string, string] => validColour(entry[1]))),
    };
  } catch { return defaults; }
}
export function savePreferences(value: Preferences) {
  try { localStorage.setItem(key(), JSON.stringify(value)); } catch { /* Keep working for this session. */ }
}
