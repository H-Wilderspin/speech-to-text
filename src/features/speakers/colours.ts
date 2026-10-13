// Dark equivalents keep the same colour families on the light caption background.
const previousColours = ['#8ecbff', '#e1afff', '#a3e4a1', '#ffb4a5', '#ffe08a', '#80e1dc', '#ffafd5', '#bdc3ff'];
export const speakerColours = ['#174f82', '#623982', '#285b28', '#853528', '#705000', '#005b58', '#84254e', '#45427e'] as const;
export const colourNames = ['Sky', 'Lilac', 'Green', 'Coral', 'Gold', 'Teal', 'Pink', 'Lavender'];
export const unknownColour = '#303840';
export type SpeakerColourChoices = Record<string, string>;

export function validColour(value: unknown): value is string {
  return typeof value === 'string' && ((speakerColours as readonly string[]).includes(value) || previousColours.includes(value));
}

export function lightColour(value: string): string {
  return speakerColours[previousColours.indexOf(value)] ?? value;
}

export function speakerColour(id: string, choices: SpeakerColourChoices = {}): string {
  if (!id.trim()) return unknownColour;
  if (Object.hasOwn(choices, id) && validColour(choices[id])) return lightColour(choices[id]!);
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return speakerColours[hash % speakerColours.length]!;
}
