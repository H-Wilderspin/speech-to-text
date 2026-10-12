// Every choice exceeds 7:1 against the caption background (#121619).
export const speakerColours = ['#8ecbff', '#e1afff', '#a3e4a1', '#ffb4a5', '#ffe08a', '#80e1dc', '#ffafd5', '#bdc3ff'] as const;
export const colourNames = ['Sky', 'Lilac', 'Green', 'Coral', 'Gold', 'Teal', 'Pink', 'Lavender'];
export const unknownColour = '#d1d5db';
export type SpeakerColourChoices = Record<string, string>;

export function validColour(value: unknown): value is string {
  return typeof value === 'string' && (speakerColours as readonly string[]).includes(value);
}

export function speakerColour(id: string, choices: SpeakerColourChoices = {}): string {
  if (!id.trim()) return unknownColour;
  if (Object.hasOwn(choices, id) && validColour(choices[id])) return choices[id]!;
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return speakerColours[hash % speakerColours.length]!;
}
