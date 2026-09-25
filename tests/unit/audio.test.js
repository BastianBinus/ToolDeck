import { describe, it, expect } from 'vitest';
import {
  SR,
  toMono16k,
  rms,
  planChunks,
  computePeaks,
  mb,
  timecode,
  clock,
  duration,
} from '../../src/tools/tonspur/audio.js';

const FRAME = SR / 10; // planChunks' analysis frame: 100 ms

// Stand-in for an AudioBuffer: the four members toMono16k reads.
function fakeBuffer(channels, sampleRate) {
  return {
    numberOfChannels: channels.length,
    length: channels[0].length,
    sampleRate,
    getChannelData: (c) => channels[c],
  };
}

// 440 Hz at 0.5 amplitude: 100 ms holds exactly 44 cycles, so every frame has the
// same level and only a planted gap can win the quietest-frame search.
function tone(seconds, amp = 0.5) {
  const a = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < a.length; i++) a[i] = amp * Math.sin((2 * Math.PI * 440 * i) / SR);
  return a;
}

function silence(audio, fromSec, toSec) {
  audio.fill(0, Math.round(fromSec * SR), Math.round(toSec * SR));
  return audio;
}

describe('toMono16k', () => {
  it('averages channels', () => {
    const left = Float32Array.from([1, 0.5, -1, 0.2]);
    const right = Float32Array.from([0, 0.5, 1, -0.6]);
    const out = toMono16k(fakeBuffer([left, right], SR));
    expect(Array.from(out)).toEqual([0.5, 0.5, 0, expect.closeTo(-0.2, 6)]);
  });

  it('passes 16 kHz mono through unchanged', () => {
    const data = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 7));
    const out = toMono16k(fakeBuffer([data], SR));
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(1000);
    for (let i = 0; i < out.length; i++) expect(out[i]).toBeCloseTo(data[i], 6);
  });

  it('downsamples 48 kHz to 16 kHz by averaging each 3-sample window', () => {
    const len = 4800; // 100 ms at 48 kHz
    const ramp = Float32Array.from({ length: len }, (_, i) => i);
    const out = toMono16k(fakeBuffer([ramp], 48000));
    expect(out.length).toBe(1600);
    // mean(3i, 3i+1, 3i+2) = 3i + 1
    for (const i of [0, 1, 2, 500, 1599]) expect(out[i]).toBeCloseTo(3 * i + 1, 3);
  });

  it('downsamples stereo 48 kHz: channel average, then window average', () => {
    const len = 48000;
    const left = new Float32Array(len).fill(0.8);
    const right = new Float32Array(len).fill(-0.2);
    const out = toMono16k(fakeBuffer([left, right], 48000));
    expect(out.length).toBe(16000);
    expect(out[0]).toBeCloseTo(0.3, 6);
    expect(out[15999]).toBeCloseTo(0.3, 6);
  });

  it('handles the non-integer 44.1 kHz ratio', () => {
    const oneSecond = new Float32Array(44100).fill(0.25);
    const out = toMono16k(fakeBuffer([oneSecond], 44100));
    expect(out.length).toBe(16000);
    // A constant signal stays constant: every window is a proper average.
    expect(Math.min(...out)).toBeCloseTo(0.25, 6);
    expect(Math.max(...out)).toBeCloseTo(0.25, 6);

    const odd = toMono16k(fakeBuffer([new Float32Array(1000)], 44100));
    expect(odd.length).toBe(Math.floor(1000 / (44100 / 16000))); // 362
  });
});

describe('rms', () => {
  it('computes root mean square over [from, to)', () => {
    const a = Float32Array.from([3, -4, 100, 100]);
    expect(rms(a, 0, 2)).toBeCloseTo(Math.sqrt(12.5), 6);
    expect(rms(a, 2, 4)).toBeCloseTo(100, 6);
  });

  it('returns 0 for an empty range instead of NaN', () => {
    expect(rms(new Float32Array(4), 2, 2)).toBe(0);
  });
});

describe('planChunks', () => {
  it('keeps short audio in one chunk', () => {
    const audio = tone(10);
    expect(planChunks(audio)).toEqual([{ start: 0, end: audio.length, silent: false }]);
  });

  it('marks all-zero audio silent', () => {
    const chunks = planChunks(new Float32Array(20 * SR));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].silent).toBe(true);
  });

  it('marks all-zero long audio silent in every chunk', () => {
    const chunks = planChunks(new Float32Array(70 * SR));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.silent)).toBe(true);
  });

  it('cuts 70 s of loud audio at the quiet gap and covers it contiguously', () => {
    const audio = tone(70);
    // A 100 ms gap slightly off the 100 ms frame grid, around 27 s.
    const gapStart = Math.round(27.03 * SR);
    const gapEnd = gapStart + FRAME;
    audio.fill(0, gapStart, gapEnd);

    const chunks = planChunks(audio);
    expect(chunks.length).toBeGreaterThanOrEqual(3);

    const firstCut = chunks[0].end;
    expect(firstCut).toBeGreaterThanOrEqual(gapStart - FRAME / 2);
    expect(firstCut).toBeLessThanOrEqual(gapEnd + FRAME / 2);
    expect(Math.abs(firstCut - (gapStart + gapEnd) / 2)).toBeLessThanOrEqual(FRAME / 2);

    expect(chunks[0].start).toBe(0);
    expect(chunks.at(-1).end).toBe(audio.length);
    for (let i = 1; i < chunks.length; i++) expect(chunks[i].start).toBe(chunks[i - 1].end);
    for (const c of chunks.slice(0, -1)) {
      expect(Number.isInteger(c.end)).toBe(true);
      expect(c.end - c.start).toBeGreaterThanOrEqual(24 * SR);
      expect(c.end - c.start).toBeLessThanOrEqual(30 * SR);
    }
    expect(chunks.at(-1).end - chunks.at(-1).start).toBeLessThanOrEqual(30 * SR);
    expect(chunks.every((c) => !c.silent)).toBe(true);
  });

  it('marks a chunk shorter than 0.5 s silent even when it is loud', () => {
    expect(planChunks(tone(0.3))).toEqual([{ start: 0, end: Math.round(0.3 * SR), silent: true }]);

    // 30.2 s with the quietest frame at the very end of the search window: the
    // cut lands near 29.95 s and leaves a loud 0.25 s tail.
    const audio = silence(tone(30.2), 29.9, 30.0);
    const chunks = planChunks(audio);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].silent).toBe(false);
    const tail = chunks[1];
    expect(tail.end - tail.start).toBeLessThan(SR / 2);
    expect(rms(audio, tail.start, tail.end)).toBeGreaterThan(0.1);
    expect(tail.silent).toBe(true);
  });

  it('marks a quiet stretch between speech silent', () => {
    // 0-25 s tone, then silence to the end: the second chunk has no speech.
    const audio = silence(tone(60), 25, 60);
    const chunks = planChunks(audio);
    expect(chunks[0].silent).toBe(false);
    expect(chunks.at(-1).silent).toBe(true);
  });
});

describe('computePeaks', () => {
  it('normalises so the loudest bucket is 1', () => {
    const audio = new Float32Array(1600);
    audio[0] = 0.2; // bucket 0
    audio[400] = -0.8; // bucket 1 (sign ignored)
    audio[808] = 0.4; // bucket 2
    const peaks = computePeaks(audio, 4);
    expect(peaks).toBeInstanceOf(Float32Array);
    expect(peaks).toHaveLength(4);
    expect(Math.max(...peaks)).toBeCloseTo(1, 6);
    expect(peaks[0]).toBeCloseTo(0.25, 6);
    expect(peaks[1]).toBeCloseTo(1, 6);
    expect(peaks[2]).toBeCloseTo(0.5, 6);
    expect(peaks[3]).toBe(0);
  });

  it('returns the requested number of buckets for real audio', () => {
    const peaks = computePeaks(tone(5), 120);
    expect(peaks).toHaveLength(120);
    expect(Math.max(...peaks)).toBeCloseTo(1, 6);
    for (const p of peaks) expect(p).toBeGreaterThan(0.9);
  });

  it('does not produce NaN for all-zero input', () => {
    const peaks = computePeaks(new Float32Array(16000), 50);
    expect(peaks).toHaveLength(50);
    for (const p of peaks) {
      expect(Number.isNaN(p)).toBe(false);
      expect(p).toBe(0);
    }
  });
});

describe('formatting', () => {
  it('mb: one decimal below 100 MB, none above', () => {
    expect(mb(0)).toBe('0.0 MB');
    expect(mb(1_234_567)).toBe('1.2 MB');
    expect(mb(99_940_000)).toBe('99.9 MB');
    expect(mb(250_000_000)).toBe('250 MB');
    expect(mb(1_500_000_000)).toBe('1500 MB');
  });

  it('timecode: always HH:MM:SS, fractional seconds floored', () => {
    expect(timecode(0)).toBe('00:00:00');
    expect(timecode(59.99)).toBe('00:00:59');
    expect(timecode(61)).toBe('00:01:01');
    expect(timecode(3725.9)).toBe('01:02:05');
    expect(timecode(36000)).toBe('10:00:00');
  });

  it('clock: MM:SS, hours only from 3600 s on', () => {
    expect(clock(0)).toBe('00:00');
    expect(clock(59.9)).toBe('00:59');
    expect(clock(754)).toBe('12:34');
    expect(clock(3599.9)).toBe('59:59');
    expect(clock(3600)).toBe('1:00:00');
    expect(clock(3725)).toBe('1:02:05');
  });

  it('duration: empty for non-finite input', () => {
    expect(duration(NaN)).toBe('');
    expect(duration(Infinity)).toBe('');
    expect(duration(-Infinity)).toBe('');
  });

  it('duration: seconds for short audio, at least 1 s', () => {
    expect(duration(0.2)).toBe('1 s');
    expect(duration(12)).toBe('12 s');
    expect(duration(29)).toBe('29 s');
  });

  it('duration: minutes and hours', () => {
    expect(duration(240)).toBe('4 min');
    expect(duration(59 * 60)).toBe('59 min');
    expect(duration(3600)).toBe('1 h 0 min');
    expect(duration(3900)).toBe('1 h 5 min');
    expect(duration(2 * 3600 + 30 * 60)).toBe('2 h 30 min');
  });
});
