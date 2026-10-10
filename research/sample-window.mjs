/** Bounded PCM history with exact sample-clock coordinates. No persistence. */
export class SampleWindow {
  constructor(capacity = 48000) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 480000) throw new Error('Invalid audio window capacity.');
    this.samples = new Float32Array(capacity); this.accepted = 0; this.closed = false;
  }
  push(samples, startSample) {
    if (this.closed || startSample !== this.accepted || !samples.length || !samples.every(Number.isFinite)) throw new Error('Audio window lost continuity.');
    for (let offset = 0; offset < samples.length;) {
      const target = this.accepted % this.samples.length;
      const count = Math.min(samples.length - offset, this.samples.length - target);
      this.samples.set(samples.subarray(offset, offset + count), target);
      offset += count; this.accepted += count;
    }
  }
  latest() {
    if (this.closed || this.accepted < this.samples.length) return undefined;
    const pivot = this.accepted % this.samples.length; const samples = new Float32Array(this.samples.length);
    samples.set(this.samples.subarray(pivot)); samples.set(this.samples.subarray(0, pivot), this.samples.length - pivot);
    return { startSample: this.accepted - samples.length, endSample: this.accepted, samples };
  }
  close() { this.samples.fill(0); this.closed = true; }
}
