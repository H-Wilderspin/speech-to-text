import { validColour, type SpeakerColourChoices } from '../speakers/colours';

export type Preferences = { textSize: number; language: string; colours: SpeakerColourChoices; hiddenSpeakers: string[]; assignedCollapsed: boolean };
const defaults: Preferences = { textSize: 32, language: 'en-GB', colours: {}, hiddenSpeakers: [], assignedCollapsed: true };
const key = () => `speech-to-text-display:${new URL(import.meta.env.BASE_URL, document.baseURI).pathname}`;
export function readPreferences(): Preferences {
  try {
    const data = JSON.parse(localStorage.getItem(key()) ?? 'null');
    if (!data || typeof data !== 'object') return defaults;
    return {
      assignedCollapsed: typeof data.assignedCollapsed === 'boolean' ? data.assignedCollapsed : true,
      textSize: Number.isInteger(data.textSize) && data.textSize >= 28 && data.textSize <= 56 ? data.textSize : 32,
      language: ['en-GB', 'en-US', 'fr-FR', 'de-DE', 'es-ES'].includes(data.language) ? data.language : 'en-GB',
      colours: Object.fromEntries(Object.entries(data.colours ?? {}).filter((entry): entry is [string, string] => validColour(entry[1]))),
      hiddenSpeakers: Array.isArray(data.hiddenSpeakers) ? [...new Set(data.hiddenSpeakers.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100))] as string[] : [],
    };
  } catch { return defaults; }
}
export function savePreferences(value: Preferences) {
  try { localStorage.setItem(key(), JSON.stringify(value)); } catch { /* Keep working for this session. */ }
}
