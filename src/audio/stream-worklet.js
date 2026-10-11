/* global AudioWorkletProcessor, registerProcessor, sampleRate, currentFrame */
// 32 unacknowledged 100 ms frames plus one partial frame (about 211 KB): allows
// short inference bursts, while remaining bounded even if the
// main thread or inference worker stalls. Never drop audio and pretend continuity.
class StreamRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(1600);
    this.used = 0;
    this.nextSample = 0;
    this.pending = new Set();
    this.expectedRenderFrame = undefined;
    this.stopping = false;
    this.done = false;
    this.port.onmessage = ({ data }) => {
      if (this.done) return;
      if (data.type === 'cancel') { this.samples.fill(0); this.done = true; }
      if (data.type === 'ack') {
        if (!this.pending.delete(data.startSample)) { this.fail('Invalid audio acknowledgement.'); return; }
        if (this.stopping) this.finish();
      }
      if (data.type === 'stop') { this.stopping = true; this.finish(); }
    };
  }
  fail(message) {
    this.samples.fill(0); this.done = true;
    this.port.postMessage({ type: 'error', message });
    return false;
  }
  emit() {
    const samples = this.used === this.samples.length ? this.samples : this.samples.slice(0, this.used);
    const startSample = this.nextSample;
    this.nextSample += this.used; this.pending.add(startSample);
    this.port.postMessage({ type: 'frame', startSample, samples }, [samples.buffer]);
    if (this.samples.byteLength) this.samples.fill(0);
    this.samples = new Float32Array(1600); this.used = 0;
  }
  finish() {
    if (this.used) {
      if (this.pending.size === 32) return;
      this.emit();
    }
    this.samples.fill(0); this.done = true;
    this.port.postMessage({ type: 'end', totalSamples: this.nextSample });
  }
  process(inputs) {
    if (this.done) return false;
    if (sampleRate !== 16000) return this.fail('The audio context must run at 16 kHz.');
    if (this.stopping) return true;
    const input = inputs[0]?.[0];
    if (!input?.length) return this.expectedRenderFrame === undefined ? true : this.fail('The audio input was interrupted.');
    if (this.expectedRenderFrame !== undefined && currentFrame !== this.expectedRenderFrame) return this.fail('The audio clock was interrupted.');
    this.expectedRenderFrame = currentFrame + input.length;
    if (!input.every(Number.isFinite)) return this.fail('The microphone produced invalid samples.');
    let offset = 0;
    while (offset < input.length) {
      const count = Math.min(input.length - offset, this.samples.length - this.used);
      this.samples.set(input.subarray(offset, offset + count), this.used);
      this.used += count; offset += count;
      if (this.used === this.samples.length) {
        if (this.pending.size === 32) return this.fail('Local speech processing could not keep up. Switch to browser captions in Settings.');
        this.emit();
      }
    }
    return true;
  }
}
registerProcessor('stream-recorder', StreamRecorder);
