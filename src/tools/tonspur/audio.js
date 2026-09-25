// Audio preparation and formatting for Tonspur. Everything here except
// decode() is pure, so it runs under unit tests without a browser.

export const SR = 16000;

// Whisper wants 16 kHz mono. Asking the AudioContext for 16 kHz makes the browser
// resample while decoding, which also keeps memory low (4 MB per minute of audio,
// instead of 23 MB at 48 kHz stereo). If the browser refuses that rate, decode at
// its native rate and downsample here.
export async function decode(buffer) {
  let ctx;
  try {
    ctx = new AudioContext({ sampleRate: SR });
  } catch {
    ctx = new AudioContext();
  }
  try {
    const decoded = await ctx.decodeAudioData(buffer);
    return toMono16k(decoded);
  } finally {
    ctx.close?.();
  }
}

// `decoded` is an AudioBuffer, or anything with the same four members.
export function toMono16k(decoded) {
  const channels = decoded.numberOfChannels;
  const len = decoded.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < channels; c++) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += data[i] / channels;
  }
  if (decoded.sampleRate === SR) return mono;
  // Box-filter downsampling: averaging each output sample's source window is
  // enough anti-aliasing for speech, which carries little energy above 8 kHz.
  const ratio = decoded.sampleRate / SR;
  const out = new Float32Array(Math.floor(len / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(len, Math.max(a + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = a; j < b; j++) sum += mono[j];
    out[i] = sum / (b - a);
  }
  return out;
}

export function rms(audio, from, to) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += audio[i] * audio[i];
  return Math.sqrt(sum / Math.max(1, to - from));
}

// Whisper hears 30 s at a time. Cutting blindly at 30 s splits words, so each cut
// lands on the quietest 100 ms between 24 s and 30 s into the chunk. Chunks with
// no speech are marked silent and skipped: Whisper invents text on silence.
export function planChunks(audio) {
  const n = audio.length;
  const frame = SR / 10;
  const chunks = [];
  let start = 0;
  while (start < n) {
    let end = n;
    if (n - start > 30 * SR) {
      let best = start + 30 * SR;
      let bestLevel = Infinity;
      for (let f = start + 24 * SR; f + frame <= start + 30 * SR; f += frame) {
        const level = rms(audio, f, f + frame);
        if (level < bestLevel) { bestLevel = level; best = f + frame / 2; }
      }
      end = Math.round(best);
    }
    const silent = end - start < SR / 2 || rms(audio, start, end) < 0.004;
    chunks.push({ start, end, silent });
    start = end;
  }
  return chunks;
}

// Peak level per bucket, normalised so the loudest bucket is 1.
export function computePeaks(audio, buckets) {
  const out = new Float32Array(buckets);
  const step = audio.length / buckets;
  let max = 1e-6;
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * step);
    const to = Math.min(audio.length, Math.floor((b + 1) * step));
    let peak = 0;
    for (let i = from; i < to; i += 8) peak = Math.max(peak, Math.abs(audio[i]));
    out[b] = peak;
    max = Math.max(max, peak);
  }
  for (let b = 0; b < buckets; b++) out[b] /= max;
  return out;
}

export const mb = (bytes) => (bytes / 1e6).toFixed(bytes < 1e8 ? 1 : 0) + ' MB';

// HH:MM:SS, for segment labels.
export const timecode = (s) => {
  const t = Math.floor(s);
  return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((n) => String(n).padStart(2, '0')).join(':');
};

// MM:SS for the big clock; hours only show up when there are any.
export const clock = (s) => {
  const t = Math.floor(s);
  const mmss = [Math.floor(t / 60) % 60, t % 60].map((n) => String(n).padStart(2, '0')).join(':');
  return t >= 3600 ? `${Math.floor(t / 3600)}:${mmss}` : mmss;
};

// Rough human duration: "12 s", "4 min", "1 h 5 min".
export const duration = (s) => {
  if (!isFinite(s)) return '';
  const m = Math.round(s / 60);
  return m < 1 ? `${Math.max(1, Math.round(s))} s` : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
