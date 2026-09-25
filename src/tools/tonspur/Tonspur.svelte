<script>
  import { onDestroy } from 'svelte';
  import { decode, planChunks, computePeaks, SR, mb, timecode, clock, duration } from './audio.js';

  let { active } = $props();

  const BARS = 60;

  // ---- remembered settings -------------------------------------------------
  const store = {
    get(k) { try { return localStorage.getItem('tonspur.' + k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem('tonspur.' + k, v); } catch {} },
  };
  const MODELS = { tiny: ['Tiny', '≈60 MB'], base: ['Base', '≈135 MB'], small: ['Small', '≈250 MB'] };
  const LANGS = { auto: 'DE + EN', de: 'Deutsch', en: 'Englisch' };
  const hasGpu = 'gpu' in navigator;
  const settings = $state({
    model: store.get('model') in MODELS ? store.get('model') : 'base',
    lang: store.get('lang') in LANGS ? store.get('lang') : 'auto',
    gpu: hasGpu && store.get('gpu') === '1',
  });

  const cycle = (name, list) => () => {
    settings[name] = list[(list.indexOf(settings[name]) + 1) % list.length];
    store.set(name, settings[name]);
  };
  const cycleModel = cycle('model', Object.keys(MODELS));
  const cycleLang = cycle('lang', Object.keys(LANGS));
  function toggleGpu() {
    settings.gpu = !settings.gpu;
    store.set('gpu', settings.gpu ? '1' : '0');
  }

  // ---- main button -------------------------------------------------------------
  // idle: no file yet · ready: file chosen · running · again: a run has finished
  const PHASES = {
    idle: ['Video wählen', ''],
    ready: ['Transkribieren', 'go'],
    running: ['Stopp', 'stop'],
    again: ['Nochmal', 'go'],
  };
  let phase = $state('idle');
  const busy = $derived(phase === 'running');

  // ---- what the page shows -----------------------------------------------------
  let file = $state.raw(null);
  let fileMeta = $state('Fotos oder Dateien');
  let status = $state('Bereit');
  let stageNum = $state('');
  let progress = $state(0);
  let notice = $state('');
  let clockDone = $state(0);
  let clockTotal = $state(null);

  let peaks = $state.raw(null);
  let chunks = $state.raw([]);
  let total = $state(0);
  let chunkState = $state([]);

  // Without peaks (no file, or not decoded yet) the bars lie flat at 4%. A bar
  // turns to the accent colour once the part its middle falls into has been
  // transcribed.
  const bars = $derived(
    Array.from({ length: BARS }, (_, b) => {
      const t = ((b + 0.5) / BARS) * total;
      const idx = chunks.findIndex((c) => t * SR < c.end);
      return {
        height: peaks ? Math.max(4, Math.round(peaks[b] * 100)) : 4,
        done: !!(peaks && chunkState[idx]),
      };
    }),
  );

  // ---- transcript ------------------------------------------------------------
  const EXAMPLES = [
    { start: 0, lang: 'de', text: 'Okay, kurzer Rundgang durch die neue Werkstatt. Links die Drehbank, die haben wir letzte Woche endlich angeschlossen.' },
    { start: 27, lang: 'en', text: 'And for the folks watching from the Austin team: this is the fixture we talked about on Monday\'s call.' },
    { start: 55, lang: 'de', text: 'Die Spannvorrichtung hält jetzt bis zu vier Teile gleichzeitig, das spart uns pro Schicht locker eine Stunde.' },
  ];
  let example = $state(true);
  let segments = $state([]);
  let tag = $state('Beispiel');
  let copyLabel = $state('Text kopieren');
  let segmentsEl;
  let fileInput;

  const shown = $derived(example ? EXAMPLES : segments);
  // The example shows its first row as the current one; a real run, its latest.
  const currentIndex = $derived(example ? 0 : segments.length - 1);
  const plainText = $derived(segments.filter((s) => s.text).map((s) => s.text).join(' '));

  let copyTimer;
  async function copy() {
    try {
      await navigator.clipboard.writeText(plainText);
      copyLabel = 'Kopiert ✓';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(segmentsEl);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      copyLabel = 'Markiert, jetzt kopieren';
    }
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copyLabel = 'Text kopieren'), 2000);
  }

  // ---- file selection ------------------------------------------------------
  function pick() {
    const next = fileInput.files[0] ?? null;
    if (!next) return;
    file = next;
    phase = 'ready';
    fileMeta = mb(file.size);
    peaks = null;
    chunks = [];
    total = 0;
    chunkState = [];
    clockDone = 0;
    clockTotal = null;
    progress = 0;
    status = 'Bereit';
    stageNum = '';
    // Safari has to hold the whole file and its decoded audio in memory at once.
    notice = file.size > 1e9
      ? 'Das ist ein großes Video. Safari kann dabei der Speicher ausgehen, dann lädt die Seite neu. Falls das passiert: das Video vorher in Fotos kürzen oder in geringerer Auflösung exportieren.'
      : '';
  }

  // ---- run -------------------------------------------------------------------
  let worker = null;
  let wakeLock = null;
  let stopRequested = false;
  let destroyed = false;

  async function holdScreen(on) {
    try {
      if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch { /* not granted: the footer already asks to keep the screen on */ }
  }

  // The browser drops the wake lock whenever the page is hidden; take it again
  // when the page comes back while a run is still going.
  function onVisibility() {
    if (document.visibilityState === 'visible' && phase === 'running' && (!wakeLock || wakeLock.released)) {
      holdScreen(true);
    }
  }

  function dropWorker() {
    worker?.terminate();
    worker = null;
  }

  // The Whisper model lives in the worker. Off screen and idle, let it go: iOS
  // reloads the whole page when a tab uses too much memory. The next run makes a
  // new worker, which loads the model again from its cache.
  $effect(() => {
    if (!active && phase !== 'running') dropWorker();
  });

  onDestroy(() => {
    destroyed = true;
    dropWorker();
    holdScreen(false);
    clearTimeout(copyTimer);
  });

  function stop() {
    stopRequested = true;
    worker?.postMessage({ type: 'cancel' });
    status = 'Stoppe nach diesem Teil …';
  }

  function act() {
    if (phase === 'idle') fileInput.click();
    else if (phase === 'running') stop();
    else run();
  }

  async function run() {
    if (!file) return;
    stopRequested = false;
    phase = 'running';
    holdScreen(true);
    notice = '';
    chunkState = [];
    progress = 0;
    status = 'Video wird gelesen …';
    stageNum = '';

    let audio;
    try {
      audio = await decode(await file.arrayBuffer());
    } catch {
      status = 'Ton konnte nicht gelesen werden';
      notice = 'Safari konnte die Tonspur dieser Datei nicht lesen. Exportiere das Video noch einmal aus Fotos oder teile es als Audiodatei (zum Beispiel .m4a).';
      phase = 'ready';
      holdScreen(false);
      return;
    }
    if (destroyed) return;

    const runChunks = planChunks(audio);
    const runTotal = audio.length / SR;
    const speaking = runChunks.filter((c) => !c.silent).length;
    peaks = computePeaks(audio, BARS);
    chunks = runChunks;
    total = runTotal;
    chunkState = [];
    fileMeta = `${mb(file.size)} · ${clock(runTotal)}`;
    clockDone = 0;
    clockTotal = runTotal;

    segments = [];
    example = false;
    tag = `0/${runChunks.length}`;

    const started = performance.now();
    let spentMs = 0;
    let doneSpeaking = 0;

    const finish = (label) => {
      status = label;
      stageNum = '';
      phase = 'again';
      holdScreen(false);
    };

    // Stop was tapped while the video was still being read.
    if (stopRequested) {
      finish('Gestoppt');
      return;
    }

    worker ??= new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    const w = worker;

    w.onmessage = ({ data }) => {
      switch (data.type) {
        case 'stage':
          if (data.stage === 'loading') {
            status = 'Sprachmodell wird geladen …';
          } else {
            status = `Höre zu · Teil 1 von ${runChunks.length}`;
            stageNum = '';
            progress = 0;
          }
          break;
        case 'download':
          status = 'Modell wird geladen · nur beim ersten Mal';
          stageNum = `${mb(data.loaded)} / ${mb(data.total)}`;
          progress = (100 * data.loaded) / data.total;
          break;
        case 'notice':
          notice = data.text;
          break;
        case 'segment': {
          segments.push(data);
          chunkState[data.index] = true;
          clockDone = data.end;
          tag = `${data.index + 1}/${runChunks.length}`;
          if (data.text || data.lang) { doneSpeaking++; spentMs += data.ms; }
          const left = speaking - doneSpeaking;
          const eta = doneSpeaking ? (spentMs / doneSpeaking) * left / 1000 : NaN;
          progress = (100 * (data.index + 1)) / runChunks.length;
          stageNum = left > 0 && isFinite(eta) ? `noch ≈${duration(eta)}` : '';
          if (data.index + 1 < runChunks.length && !stopRequested) {
            status = `Höre zu · Teil ${data.index + 2} von ${runChunks.length}`;
          }
          break;
        }
        case 'done':
          finish(`Fertig in ${duration((performance.now() - started) / 1000)}`);
          break;
        case 'cancelled':
          finish('Gestoppt');
          break;
        case 'error':
          finish('Etwas ist schiefgelaufen');
          notice = `${data.text}. Falls das beim Laden des Modells passiert ist: Verbindung prüfen und nochmal versuchen. Mit eingeschalteter GPU: einmal ohne probieren.`;
          w.terminate();
          if (worker === w) worker = null;
          break;
      }
    };

    const device = settings.gpu ? 'webgpu' : 'wasm';
    w.postMessage(
      { type: 'run', audio, chunks: runChunks, model: settings.model, language: settings.lang, device },
      [audio.buffer],
    );
  }
</script>

<svelte:document onvisibilitychange={onVisibility} />

<div class="tonspur">
  <header class="head">
    <h2>Tonspur</h2>
    <p class="sub mono">Video → Text · auf dem Gerät</p>
  </header>

  <label class="stage">
    <input bind:this={fileInput} type="file" accept="video/*,audio/*" aria-label="Video wählen" disabled={busy} onchange={pick}>
    <span class="meta mono"><span>{file ? file.name : 'Noch kein Video'}</span><span>{fileMeta}</span></span>
    <span class="wave" class:has-file={!!file} aria-hidden="true">
      {#each bars as bar, b (b)}
        <i class:done={bar.done} style:height="{bar.height}%"></i>
      {/each}
      {#if !file}
        <span class="empty">
          <span>
            <b><svg width="30" height="30" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="4" width="11" height="12" rx="2"/><path d="M13 8.5l5-2.5v8l-5-2.5"/></svg></b>
            Tippen, um ein Video zu wählen
          </span>
        </span>
      {/if}
    </span>
    <span class="clock">
      <span class="tc mono">{clock(clockDone)}<small>{` / ${clockTotal == null ? '--:--' : clock(clockTotal)}`}</small></span>
      <span class="num mono">{stageNum}</span>
    </span>
    <span class="progress">
      <span class="track"><i style:width="{progress}%"></i></span>
      <span class="stage-text" role="status">{status}</span>
    </span>
  </label>

  <section class="settings" aria-label="Einstellungen">
    <div class="chips">
      <button
        class="chip"
        type="button"
        data-testid="chip-model"
        aria-label="Modell: {MODELS[settings.model][0]}, {MODELS[settings.model][1]}"
        disabled={busy}
        onclick={cycleModel}
      >{MODELS[settings.model][0]}<small class="mono">{MODELS[settings.model][1]}</small></button>
      <button
        class="chip"
        type="button"
        data-testid="chip-lang"
        aria-label="Sprache: {LANGS[settings.lang]}"
        disabled={busy}
        onclick={cycleLang}
      >{LANGS[settings.lang]}</button>
      <button
        class="chip"
        type="button"
        data-testid="chip-gpu"
        aria-label="Läuft auf: {settings.gpu ? 'GPU' : 'CPU'}"
        title={hasGpu ? undefined : 'Dieser Browser hat kein WebGPU'}
        disabled={busy || !hasGpu}
        onclick={toggleGpu}
      >{settings.gpu ? 'GPU' : 'CPU'}</button>
      <span class="hint">zum Ändern tippen</span>
    </div>
    <div class="notice" data-testid="notice" hidden={!notice}>{notice}</div>
  </section>

  <section class="transcript" class:example aria-label="Transkript">
    <div class="transcript-head">
      <h3 class="mono">Transkript · {tag}</h3>
      <button class="copy" type="button" data-testid="copy" hidden={example || !plainText} onclick={copy}>{copyLabel}</button>
    </div>
    <div class="segments" data-testid="segments" bind:this={segmentsEl}>
      {#each shown as seg, i (i)}
        <div class="segment" class:current={i === currentIndex} class:quiet={!seg.text}>
          <div class="tc mono">{timecode(seg.start)}{seg.lang ? ` · ${seg.lang.toUpperCase()}` : ''}</div>
          <p>{seg.text || 'Keine Sprache'}</p>
        </div>
      {/each}
    </div>
  </section>

  <footer>
    <p>Der Ton verlässt nie dieses Gerät. Heruntergeladen wird nur das Sprachmodell, von Hugging Face, beim ersten Mal. Danach bleibt es auf dem Gerät gespeichert.</p>
    <p>Lass den Bildschirm an und diese Seite offen, solange es läuft. iOS pausiert Tabs im Hintergrund.</p>
  </footer>

  <div class="dock">
    <button class="fab {PHASES[phase][1]}" type="button" data-testid="tonspur-action" onclick={act}>{PHASES[phase][0]}</button>
  </div>
</div>

<style>
  .tonspur {
    max-width: 620px; margin: 0 auto;
    padding: 28px var(--gutter-r) 0 var(--gutter);
    display: grid; gap: 22px;
  }

  .head { display: grid; gap: 4px; }
  h2 { margin: 0; font-size: 34px; line-height: 1.1; font-weight: 600; letter-spacing: -0.025em; }
  .sub { margin: 0; font-size: 12px; color: var(--muted); }

  /* waveform stage, an index card */
  .stage {
    position: relative;
    display: grid; gap: 14px;
    padding: 14px 16px 16px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 6px;
    cursor: pointer;
  }
  .stage input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
  .stage:has(input:disabled) { cursor: default; }
  .stage:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 3px; }
  .meta {
    display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
    font-size: 12px; color: var(--muted);
    padding-bottom: 8px; border-bottom: 1.5px solid var(--accent);
  }
  .meta span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .meta span:last-child { white-space: nowrap; }
  .wave { position: relative; height: 170px; display: flex; align-items: center; gap: 2px; }
  .wave i { flex: 1; min-width: 0; border-radius: 3px; background: var(--line); transition: background 0.35s, height 0.5s; }
  .wave.has-file i { background: var(--faint); }
  .wave.has-file i.done { background: var(--accent); }
  .empty { position: absolute; inset: 0; display: grid; place-items: center; }
  .empty > span { display: grid; justify-items: center; gap: 12px; font-size: 15px; font-weight: 500; }
  .empty b {
    width: 76px; height: 76px; border-radius: 38px;
    background: var(--ink); color: var(--paper);
    display: grid; place-items: center;
  }
  .clock { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
  .clock .tc { font-size: 44px; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .clock .tc small { font-size: 16px; color: var(--faint); letter-spacing: 0; }
  .clock .num { font-size: 12px; color: var(--muted); text-align: right; padding-bottom: 4px; font-variant-numeric: tabular-nums; }
  .progress { display: grid; gap: 8px; }
  .track { height: 3px; border-radius: 2px; background: var(--line); overflow: hidden; }
  .track i { display: block; height: 100%; background: var(--accent); transition: width 0.25s; }
  .stage-text { font-size: 13px; color: var(--muted); }

  /* settings chips */
  .settings { display: grid; gap: 12px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    display: flex; align-items: baseline; gap: 6px;
    background: var(--card); border: 1px solid var(--line); color: var(--ink);
    border-radius: 8px; padding: 9px 12px; font-size: 14px; font-weight: 500; line-height: 1.5;
  }
  .chip small { font-size: 11px; color: var(--muted); }
  .chip:disabled { opacity: 0.45; }
  .hint { align-self: center; font-size: 12px; color: var(--faint); }
  .notice { background: var(--warn-soft); color: var(--warn); border-radius: 6px; padding: 10px 12px; font-size: 14px; }

  /* transcript */
  .transcript { display: grid; gap: 14px; border-top: 1px solid var(--line); padding-top: 20px; }
  .transcript.example { opacity: 0.6; }
  .transcript-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 33px; }
  h3 { margin: 0; font-size: 11px; line-height: 1.4; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; }
  .copy {
    border: 0; background: var(--accent-soft); color: var(--accent);
    border-radius: 8px; padding: 7px 12px; font-size: 13px; font-weight: 600; line-height: 1.45;
  }
  .segments { display: grid; gap: 14px; }
  .segment { display: grid; gap: 4px; }
  .segment .tc { font-size: 11px; line-height: 1.4; color: var(--accent); font-variant-numeric: tabular-nums; }
  .segment p {
    margin: 0; line-height: 1.45; font-size: 16px; color: var(--muted);
    text-wrap: pretty; overflow-wrap: anywhere;
    transition: font-size 0.3s, color 0.3s;
  }
  .segment.current p { font-size: 21px; color: var(--ink); }
  .segment.quiet p { font-style: italic; color: var(--faint); }

  footer { color: var(--muted); font-size: 13px; max-width: 62ch; }
  footer p { margin: 0 0 6px; }

  /* The action button rides along the bottom of the page. Sticky, not fixed:
     the page is one of several side by side, and a fixed button would show on
     all of them. */
  .dock {
    position: sticky; bottom: 0; z-index: 1;
    margin: 0 calc(-1 * var(--gutter-r)) 0 calc(-1 * var(--gutter));
    padding: 30px var(--gutter-r) max(22px, env(safe-area-inset-bottom)) var(--gutter);
    display: flex; justify-content: center;
    background: linear-gradient(transparent, var(--paper) 30px);
    pointer-events: none;
  }
  .fab {
    pointer-events: auto;
    height: 56px; padding: 0 30px; border: 0; border-radius: 28px;
    font-size: 17px; font-weight: 600;
    background: var(--ink); color: var(--paper);
  }
  .fab.go { background: var(--accent); color: var(--on-accent); }
  .fab.stop { background: transparent; color: var(--ink); border: 1.5px solid var(--ink); }

  @media (prefers-reduced-motion: reduce) {
    .track i, .wave i, .segment p { transition: none; }
  }
</style>
