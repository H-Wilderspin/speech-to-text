/** Basic signal checks only: energy is not proof of speech or speaker identity. */
export function checkRecording(samples: Float32Array): void {
  if (samples.length < 16000 * 3 || samples.length > 16000 * 30 || !samples.every(Number.isFinite)) {
    throw new Error('The recording was incomplete. Try again and keep the app open.');
  }
  let energy = 0; let clipped = 0;
  for (const value of samples) { energy += value * value; if (Math.abs(value) >= .99) clipped++; }
  if (Math.sqrt(energy / samples.length) < .003) throw new Error('The recording was too quiet. Move closer and try again.');
  if (clipped / samples.length > .05) throw new Error('The recording was distorted. Move a little farther away and try again.');
}
