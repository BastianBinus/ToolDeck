<script>
  import { videoId, target, shortcutUrl, QUALITIES, QUALITY_ORDER, SHORTCUT } from './youtube.js';

  // Nothing here holds memory worth freeing, so `active` is not needed.

  const store = {
    get(k) { try { return localStorage.getItem('mitschnitt.' + k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem('mitschnitt.' + k, v); } catch {} },
  };

  let link = $state('');
  let quality = $state(store.get('quality') in QUALITIES ? store.get('quality') : '720');
  // The setup stays open until it has been closed once.
  let setupOpen = $state(store.get('setup') !== 'closed');

  const id = $derived(videoId(link));
  const href = $derived(id ? shortcutUrl(target(id, quality)) : null);
  const invalid = $derived(!!link.trim() && !id);
  const meta = $derived(!link.trim() ? 'Paste a link' : id ? `ID ${id}` : 'Not a YouTube link');

  function choose(q) {
    quality = q;
    store.set('quality', q);
  }

  async function paste() {
    try {
      link = (await navigator.clipboard.readText()).trim();
    } catch {
      // Denied or unsupported: the field stays as it was, pasting by hand works.
    }
  }

  function toggleSetup() {
    setupOpen = !setupOpen;
    store.set('setup', setupOpen ? 'open' : 'closed');
  }

  const scriptUrl = new URL(`${import.meta.env.BASE_URL}mitschnitt/ytmp4.py`, location.origin).href;
  // One short line per command: a-Shell garbles pasted lines that wrap over several
  // terminal rows (holzschu/a-shell#1057), so nothing here may be chained into one long line.
  const COMMANDS = {
    install: 'pip install -U yt-dlp',
    dir: 'mkdir -p ~/Documents/bin && cd ~/Documents/bin',
    // A directory left at this path by an earlier attempt would silently swallow the download.
    clean: 'rm -rf ytmp4.py',
    fetch: `curl -fLO ${scriptUrl}`,
    check: 'test -f ytmp4.py && echo OK || echo ERROR',
    shortcut: "python3 ~/Documents/bin/ytmp4.py '<Shortcut Input>'",
  };
  let copied = $state('');

  async function copy(key) {
    try {
      await navigator.clipboard.writeText(COMMANDS[key]);
      copied = key;
      setTimeout(() => { if (copied === key) copied = ''; }, 1500);
    } catch {}
  }

  // Shown while iOS switches over to Shortcuts.
  let toast = $state('');
  let toastTimer;
  function launched() {
    toast = `Opening Shortcuts → ${SHORTCUT} · ${QUALITIES[quality]}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), 2200);
  }
</script>

{#snippet command(key)}
  <div class="cmd">
    <code class="mono">{COMMANDS[key]}</code>
    <button type="button" class="copy" onclick={() => copy(key)}>{copied === key ? 'Copied' : 'Copy'}</button>
  </div>
{/snippet}

<div class="mitschnitt">
  <div class="card">
    <label class="meta mono" for="mitschnitt-link">
      <span>Video</span><span class:warn={invalid} class:ok={!!id} data-testid="mitschnitt-meta">{meta}</span>
    </label>
    <div class="field">
      <input
        id="mitschnitt-link"
        type="url"
        inputmode="url"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="https://youtu.be/…"
        aria-label="YouTube link"
        aria-invalid={invalid}
        bind:value={link}
      >
      <button type="button" class="paste" onclick={paste}>Paste</button>
    </div>
    <div class="segmented" role="radiogroup" aria-label="Quality" data-testid="mitschnitt-quality">
      {#each QUALITY_ORDER as q (q)}
        <button
          type="button"
          role="radio"
          class="mono"
          aria-checked={quality === q}
          aria-label={q === 'best' ? 'Best, no limit' : `At most ${QUALITIES[q]}`}
          onclick={() => choose(q)}
        >{QUALITIES[q]}</button>
      {/each}
    </div>
  </div>

  <section class="setup" class:open={setupOpen}>
    <button type="button" class="summary mono" aria-expanded={setupOpen} aria-controls="mitschnitt-setup" onclick={toggleSetup}>
      <span>One-time setup · 4 steps</span><span class="chevron" aria-hidden="true">›</span>
    </button>
    <ol id="mitschnitt-setup" hidden={!setupOpen}>
      <li>
        <span class="n mono">01</span>
        <div>
          <p>Install <b>a-Shell</b> from the App Store (not “mini”) and load yt-dlp in it:</p>
          {@render command('install')}
        </div>
      </li>
      <li>
        <span class="n mono">02</span>
        <div>
          <p>Fetch the download script in a-Shell, one line at a time. The last one has to print <b class="mono">OK</b>:</p>
          {@render command('dir')}
          {@render command('clean')}
          {@render command('fetch')}
          {@render command('check')}
          <p class="note">
            Paste each line on its own. a-Shell garbles long pasted lines that wrap over several rows,
            also commands copied from elsewhere. If one breaks apart, type it by hand.
          </p>
        </div>
      </li>
      <li>
        <span class="n mono">03</span>
        <div>
          <p>
            In <b>Shortcuts</b>, create a shortcut named exactly <b class="mono">{SHORTCUT}</b>. Add a-Shell’s
            <i>Execute Command</i> action, set it to <i>In App</i>, and enter this with <i>Shortcut Input</i> as the variable:
          </p>
          {@render command('shortcut')}
        </div>
      </li>
      <li>
        <span class="n mono">04</span>
        <div>
          <p>
            Optional: turn on <i>Show in Share Sheet</i> for URLs to send links straight from the YouTube app,
            without this page.
          </p>
        </div>
      </li>
    </ol>
  </section>

  <footer>
    <p>The MP4 lands in <i>Files → a-Shell → YouTube</i>. From there, <i>Share → Save Video</i> puts it in Photos.</p>
    <p>
      Without ffmpeg, yt-dlp only gets formats with picture and sound already combined, usually 360p on YouTube.
      <code class="mono">pkg install ffmpeg</code> in a-Shell may allow more; whether yt-dlp can use that
      WebAssembly ffmpeg is not tested yet.
    </p>
    <p>If downloads suddenly fail, YouTube has usually changed something. Run <code class="mono">pip install -U yt-dlp</code> in a-Shell.</p>
  </footer>

  <div class="dock">
    {#if toast}<span class="toast mono" role="status">{toast}</span>{/if}
    {#if href}
      <a class="fab go" data-testid="mitschnitt-action" {href} onclick={launched}>Download</a>
    {:else}
      <button class="fab" type="button" data-testid="mitschnitt-action" disabled>Download</button>
    {/if}
  </div>
</div>

<style>
  .mitschnitt {
    flex: 1;
    width: 100%; max-width: 620px; margin: 0 auto;
    padding: 20px var(--gutter-r) 0 var(--gutter);
    display: grid; gap: 20px;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto 1fr;
  }

  .card {
    display: grid; gap: 14px;
    padding: 14px 16px 16px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
  }
  .meta {
    display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
    font-size: 12px; line-height: 1.4; color: var(--muted);
    padding-bottom: 8px; border-bottom: 1.5px solid var(--accent);
  }
  .meta span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .meta .ok { color: var(--ink); }
  .meta .warn { color: var(--warn); }
  .field { display: flex; gap: 8px; min-width: 0; }
  input {
    flex: 1; min-width: 0;
    /* 16px keeps iOS Safari from zooming in on focus. */
    font: 16px/1.4 var(--mono); color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
    padding: 11px 12px;
  }
  input::placeholder { color: var(--faint); }
  input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  input[aria-invalid="true"] { border-color: var(--warn); }
  .paste {
    border: 0; background: var(--accent-soft); color: var(--accent);
    border-radius: 10px; padding: 0 14px; font-size: 14px; font-weight: 600;
  }

  .segmented { display: flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .segmented button {
    flex: 1; border: 0; padding: 9px 0;
    font-size: 13px; background: transparent; color: var(--muted);
  }
  .segmented button + button { border-left: 1px solid var(--line); }
  .segmented button[aria-checked="true"] { background: var(--ink); color: var(--on-accent); }
  .segmented button:focus-visible { outline-offset: -2px; }

  .setup { border-top: 1px solid var(--line); }
  .summary {
    width: 100%;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    border: 0; background: none; padding: 18px 2px 6px; text-align: left;
    font-size: 11px; line-height: 1.4; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase;
  }
  .chevron { font-size: 16px; transition: transform 0.2s; }
  .open .chevron { transform: rotate(90deg); }
  .setup ol { list-style: none; margin: 0; padding: 10px 2px 4px; display: grid; gap: 16px; }
  .setup li { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; }
  .n { font-size: 13px; line-height: 1.6; color: var(--accent); }
  .setup li > div { display: grid; gap: 8px; min-width: 0; }
  .setup p { margin: 0; font-size: 15px; text-wrap: pretty; }
  .setup p.note { font-size: 13px; color: var(--muted); }
  .cmd {
    display: flex; align-items: flex-start; gap: 8px;
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 10px 10px 10px 12px;
  }
  .cmd code { flex: 1; min-width: 0; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; user-select: all; -webkit-user-select: all; }
  .copy {
    border: 0; background: var(--accent-soft); color: var(--accent);
    border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 600; white-space: nowrap;
  }

  footer { padding: 0 2px; color: var(--muted); font-size: 13px; }
  footer p { margin: 0 0 8px; }
  footer code { font-size: 12px; }

  /* Sticky, not fixed: see the tool contract in README.md. */
  .dock {
    position: sticky; bottom: 0; z-index: 1;
    align-self: end;
    margin: 0 calc(-1 * var(--gutter-r)) 0 calc(-1 * var(--gutter));
    padding: 28px var(--gutter-r) max(26px, env(safe-area-inset-bottom)) var(--gutter);
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    background: linear-gradient(transparent, var(--bg) 36px);
    pointer-events: none;
  }
  .toast {
    font-size: 12px; padding: 8px 12px; border-radius: 8px;
    background: var(--off); border: 1px solid var(--line);
  }
  .fab {
    pointer-events: auto;
    display: inline-flex; align-items: center;
    height: 56px; padding: 0 40px; border: 0; border-radius: 28px;
    font-size: 17px; font-weight: 600; text-decoration: none;
    background: var(--off); color: var(--faint);
    transition: background 0.2s, color 0.2s;
  }
  .fab.go { background: var(--accent); color: var(--on-accent); }

  @media (prefers-reduced-motion: reduce) {
    .chevron, .fab { transition: none; }
  }
</style>
