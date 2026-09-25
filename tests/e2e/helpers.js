import { expect } from '@playwright/test';

export const SR = 16000;

// ---- test audio ----------------------------------------------------------------

// 16-bit PCM mono WAV at 16 kHz. `level(t)` gives the amplitude (0..1) of a
// 220 Hz tone at time t in seconds; 0 means digital silence.
export function wav(seconds, level = () => 0.5) {
  const n = Math.round(seconds * SR);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v = level(t) * Math.sin(2 * Math.PI * 220 * t);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2);
  }
  return buf;
}

// 65 s of tone: planChunks cuts it into three parts, none silent.
export const LOUD_65 = () => ({ name: 'interview.wav', mimeType: 'audio/wav', buffer: wav(65) });

// 10 s of tone, then 30 s of silence: part 1 has speech, part 2 is silent.
export const WITH_SILENCE = () => ({
  name: 'pause.wav',
  mimeType: 'audio/wav',
  buffer: wav(40, (t) => (t < 10 ? 0.5 : 0)),
});

// Random bytes with a video name: decodeAudioData rejects it.
export const GARBAGE = () => {
  const buffer = Buffer.alloc(64 * 1024);
  for (let i = 0; i < buffer.length; i++) buffer[i] = (i * 2654435761) >>> 24;
  return { name: 'x.mp4', mimeType: 'video/mp4', buffer };
};

// ---- fake worker -----------------------------------------------------------------

// Replaces window.Worker before any page script runs. Every constructed worker is
// recorded on window.__fakeWorkers with the messages the page posted to it and
// whether it was terminated. Behaviour comes from window.__fakeMode at run time:
//   'ok'    loading → download → transcribing → one segment per chunk → done
//   'slow'  like ok, but after the first segment waits for {type:'cancel'}
//   'error' loading → error
// Segment text for a spoken chunk i is `Teil ${i + 1} gesprochen.`, language
// alternating de/en; silent chunks give text '' and lang null, like worker.js.
export async function installFakeWorker(page, mode = 'ok') {
  await page.addInitScript((initialMode) => {
    window.__fakeMode = initialMode;
    window.__fakeWorkers = [];

    class FakeWorker extends EventTarget {
      constructor(url, options) {
        super();
        this.url = String(url);
        this.options = options;
        this.messages = [];
        this.terminated = false;
        this.onmessage = null;
        this.onerror = null;
        this._waitingForCancel = false;
        this._runChunks = [];
        window.__fakeWorkers.push(this);
      }

      _emit(data) {
        if (this.terminated) return;
        const ev = new MessageEvent('message', { data });
        this.onmessage?.(ev);
        this.dispatchEvent(ev);
      }

      _later(ms, data) {
        return new Promise((r) => setTimeout(r, ms)).then(() => this._emit(data));
      }

      postMessage(msg, transfer) {
        if (this.terminated) return;
        // Behave like a real worker: structured clone, transferred buffers detach.
        const data = structuredClone(msg, { transfer: Array.isArray(transfer) ? transfer : [] });
        this.messages.push({
          type: data.type,
          model: data.model,
          language: data.language,
          device: data.device,
          chunks: data.chunks,
          audioType: data.audio?.constructor?.name,
          audioLength: data.audio?.length,
          transferred: Array.isArray(transfer) ? transfer.length : 0,
          detachedInPage: msg.audio ? msg.audio.buffer.byteLength === 0 : undefined,
        });
        if (data.type === 'run') this._run(data);
        if (data.type === 'cancel' && this._waitingForCancel) {
          this._waitingForCancel = false;
          this._later(20, { type: 'cancelled' });
        }
      }

      async _segment(i) {
        const c = this._runChunks[i];
        await this._later(30, {
          type: 'segment',
          index: i,
          start: c.start / 16000,
          end: c.end / 16000,
          text: c.silent ? '' : `Teil ${i + 1} gesprochen.`,
          lang: c.silent ? null : i % 2 ? 'en' : 'de',
          ms: c.silent ? 0 : 400,
        });
      }

      async _run({ chunks }) {
        const mode = window.__fakeMode;
        this._runChunks = chunks;
        await this._later(20, { type: 'stage', stage: 'loading' });
        if (mode === 'error') {
          await this._later(20, { type: 'error', text: 'Failed to fetch' });
          return;
        }
        await this._later(20, { type: 'download', loaded: 50e6, total: 135e6 });
        await this._later(20, { type: 'download', loaded: 135e6, total: 135e6 });
        await this._later(20, { type: 'stage', stage: 'transcribing', total: chunks.length });
        if (mode === 'slow') {
          await this._segment(0);
          this._waitingForCancel = true;
          return;
        }
        for (let i = 0; i < chunks.length; i++) await this._segment(i);
        await this._later(20, { type: 'done' });
      }

      terminate() {
        this.terminated = true;
      }
    }

    window.Worker = FakeWorker;
  }, mode);
}

export const fakeWorkers = (page) =>
  page.evaluate(() =>
    window.__fakeWorkers.map((w) => ({
      url: w.url,
      options: w.options,
      messages: w.messages,
      terminated: w.terminated,
    })),
  );

// ---- deck navigation -------------------------------------------------------------

export const deck = (page) => page.locator('main.deck');

// Scroll the deck like a finished swipe would.
export async function scrollDeckTo(page, index) {
  await deck(page).evaluate((el, i) => el.scrollTo({ left: i * el.clientWidth, behavior: 'instant' }), index);
}

export async function currentLabel(page) {
  return page.locator('header .label').textContent();
}

// Opens the Tonspur page from a deep link and waits for the component.
export async function openTonspur(page) {
  await page.goto('./#tonspur');
  await expect(page.getByTestId('tonspur-action')).toBeVisible();
}

export const action = (page) => page.getByTestId('tonspur-action');
export const status = (page) => page.getByRole('status');
export const fileInput = (page) => page.locator('input[type=file][aria-label="Video wählen"]');
