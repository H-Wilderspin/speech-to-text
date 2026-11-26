export const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))),
  byte => byte.toString(16).padStart(2, '0')).join('');
