/* global AudioWorkletProcessor, registerProcessor, sampleRate */
class EnrolmentRecorder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const seconds = options?.processorOptions?.durationSeconds ?? 8;
    if (!Number.isInteger(seconds) || seconds < 3 || seconds > 30) throw new Error('Invalid recording duration.');
    this.samples = new Float32Array(Math.round(sampleRate * seconds));
    this.offset = 0;
    this.lastProgress = 0;
    this.cancelled = false;
    this.port.onmessage = () => { this.cancelled = true; this.samples.fill(0); };
  }
  process(inputs) {
    if (this.cancelled) return false;
    const input = inputs[0]?.[0];
    if (!input) return true;
    const count = Math.min(input.length, this.samples.length - this.offset);
    this.samples.set(input.subarray(0, count), this.offset);
    this.offset += count;
    if (this.offset === this.samples.length) {
      this.port.postMessage({ samples: this.samples }, [this.samples.buffer]);
      return false;
    }
    if (this.offset - this.lastProgress >= sampleRate / 4) {
      this.lastProgress = this.offset;
      this.port.postMessage({ seconds: this.offset / sampleRate });
    }
    return true;
  }
}
registerProcessor('enrolment-recorder', EnrolmentRecorder);
