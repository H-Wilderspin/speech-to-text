import type { AudioFrame } from '../../audio/streaming';

export interface AudioWindow {
  index: number;
  startSample: number;
  acceptFrom: number;
  acceptUntil: number;
  samples: Float32Array;
}

/** 24-second context, 20-second stride; the overlap is owned exactly once.
 * Sample-clock positions never depend on browser transcript event timing. */
export class AudioWindows {
  private buffer = new Float32Array(24 * 16000);
  private length = 0;
  private start = 0;
  private accepted = 0;
  private index = 0;
  private clock?: string;
  private finished = false;

  constructor(private readonly emit: (window: AudioWindow) => void) {}

  add(frame: AudioFrame) {
    if (this.finished || frame.sampleRate !== 16000 || frame.startSample !== this.start + this.length
      || (this.clock && frame.clockId !== this.clock)) throw new Error('The comparison audio clock was interrupted.');
    this.clock = frame.clockId;
    let offset = 0;
    while (offset < frame.samples.length) {
      const take = Math.min(frame.samples.length - offset, this.buffer.length - this.length);
      this.buffer.set(frame.samples.subarray(offset, offset + take), this.length);
      offset += take; this.length += take;
      if (this.length === this.buffer.length) {
        this.send(this.start + 22 * 16000);
        this.buffer.copyWithin(0, 20 * 16000);
        this.buffer.fill(0, 4 * 16000);
        this.length = 4 * 16000; this.start += 20 * 16000;
      }
    }
  }

  private send(until: number) {
    this.emit({ index: this.index++, startSample: this.start, acceptFrom: this.accepted,
      acceptUntil: until, samples: this.buffer.slice(0, this.length) });
    this.accepted = until;
  }

  finish() {
    if (this.finished) return;
    try { if (this.start + this.length > this.accepted) this.send(this.start + this.length); }
    finally { this.erase(); }
  }

  erase() { this.buffer.fill(0); this.length = 0; this.finished = true; }
}
