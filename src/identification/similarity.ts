/** Cosine similarity is a measurement, not a probability or an identity decision. */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number | null {
  if (!a.length || a.length !== b.length || a.length > 4096) return null;
  let aSquared = 0; let bSquared = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return null;
    aSquared += a[i]! ** 2; bSquared += b[i]! ** 2;
  }
  const aNorm = Math.sqrt(aSquared); const bNorm = Math.sqrt(bSquared);
  if (!Number.isFinite(aNorm) || !Number.isFinite(bNorm) || aNorm === 0 || bNorm === 0) return null;
  let score = 0;
  for (let i = 0; i < a.length; i++) score += (a[i]! / aNorm) * (b[i]! / bNorm);
  return Math.max(-1, Math.min(1, score));
}
