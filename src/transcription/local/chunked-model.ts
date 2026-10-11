type Part = { name: string; bytes: number; hash: string };

/** Individual SHA-256 checks happen in readPart. Build verification also checks
 * the joined model hash; avoid a second full-model copy for hashing on phones. */
export async function assembleModel(manifest: { bytes: number; parts: readonly Part[] },
  readPart: (part: Part) => Promise<Uint8Array<ArrayBuffer>>, signal: AbortSignal) {
  if (!Number.isSafeInteger(manifest.bytes) || manifest.bytes <= 0 || manifest.bytes > 256 * 1024 * 1024
    || !manifest.parts.length || manifest.parts.some((part) => !Number.isSafeInteger(part.bytes) || part.bytes <= 0)
    || manifest.parts.reduce((total, part) => total + part.bytes, 0) !== manifest.bytes) throw new Error('Invalid local model manifest.');
  signal.throwIfAborted();
  let joined: Uint8Array<ArrayBuffer> | undefined; let offset = 0;
  for (const part of manifest.parts) {
    signal.throwIfAborted();
    const bytes = await readPart(part); signal.throwIfAborted();
    if (bytes.length !== part.bytes) throw new Error('The local model part is incomplete. Prepare it again.');
    joined ??= new Uint8Array(manifest.bytes);
    joined.set(bytes, offset); offset += bytes.length;
  }
  return joined!;
}
