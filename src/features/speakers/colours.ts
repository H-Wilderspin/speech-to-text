// Dark colours preserve contrast on the app's pale background. Names remain
// visible: colours are a redundant cue, not a guarantee of distinct identities.
export const speakerColours = ['#174e8c', '#783b83', '#286132', '#9b352c', '#725016', '#00656b', '#923f65', '#514a91'] as const;
export const unknownColour = '#43534a';

export function speakerColour(id: string): string {
  if (!id.trim()) return unknownColour;
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return speakerColours[hash % speakerColours.length]!;
}
