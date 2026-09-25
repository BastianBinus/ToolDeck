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
  const meta = $derived(!link.trim() ? 'Link einfügen' : id ? `ID ${id}` : 'Kein YouTube-Link');

  function cycleQuality() {
    quality = QUALITY_ORDER[(QUALITY_ORDER.indexOf(quality) + 1) % QUALITY_ORDER.length];
    store.set('quality', quality);
  }

  async function paste() {
    try {
      link = (await navigator.clipboard.readText()).trim();
    } catch {
      // Denied or unsupported: the field stays as it was, pasting by hand works.
    }
  }

  function onToggle(e) {
    setupOpen = e.currentTarget.open;
    store.set('setup', setupOpen ? 'open' : 'closed');
  }

  const scriptUrl = new URL(`${import.meta.env.BASE_URL}mitschnitt/ytmp4.py`, location.origin).href;
  const COMMANDS = {
    install: 'pip install -U yt-dlp',
    script: `mkdir -p ~/Documents/bin && curl -L ${scriptUrl} -o ~/Documents/bin/ytmp4.py`,
    shortcut: "python3 ~/Documents/bin/ytmp4.py '<Kurzbefehleingabe>'",
  };
  let copied = $state('');

  async function copy(key) {
    try {
      await navigator.clipboard.writeText(COMMANDS[key]);
      copied = key;
      setTimeout(() => { if (copied === key) copied = ''; }, 1500);
    } catch {}
  }
</script>

{#snippet command(key)}
  <div class="cmd">
    <code class="mono">{COMMANDS[key]}</code>
    <button type="button" class="copy" onclick={() => copy(key)}>{copied === key ? 'Kopiert' : 'Kopieren'}</button>
  </div>
{/snippet}

<div class="mitschnitt">
  <header class="head">
    <h2>Mitschnitt</h2>
    <p class="sub mono">YouTube → MP4 · über a-Shell</p>
  </header>

  <div class="card">
    <label class="meta mono" for="mitschnitt-link"><span>Video</span><span data-testid="mitschnitt-meta">{meta}</span></label>
    <div class="field">
      <input
        id="mitschnitt-link"
        type="url"
        inputmode="url"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="https://youtu.be/…"
        aria-label="YouTube-Link"
        aria-invalid={!!link.trim() && !id}
        bind:value={link}
      >
      <button type="button" class="paste" onclick={paste}>Einfügen</button>
    </div>
    <div class="chips">
      <button type="button" class="chip" data-testid="mitschnitt-quality" onclick={cycleQuality}>
        {QUALITIES[quality]}<small class="mono">{quality === 'best' ? 'ohne Grenze' : 'höchstens'}</small>
      </button>
      <span class="hint">zum Ändern tippen</span>
    </div>
  </div>

  <details class="setup" open={setupOpen} ontoggle={onToggle}>
    <summary class="mono">Einrichtung · einmalig</summary>
    <ol>
      <li>
        <p><b>a-Shell</b> aus dem App Store installieren (nicht „mini“) und darin yt-dlp laden:</p>
        {@render command('install')}
      </li>
      <li>
        <p>Das Download-Skript in a-Shell holen:</p>
        {@render command('script')}
      </li>
      <li>
        <p>
          In <b>Kurzbefehle</b> einen neuen Kurzbefehl <b class="mono">{SHORTCUT}</b> anlegen, genau so benannt.
          Aktion <i>Execute Command</i> von a-Shell hinzufügen, auf <i>In App</i> stellen und als Befehl eintragen,
          dabei <i>Kurzbefehleingabe</i> als Variable einsetzen:
        </p>
        {@render command('shortcut')}
      </li>
      <li>
        <p>
          Optional: im Kurzbefehl <i>Im Share-Sheet anzeigen</i> für URLs einschalten. Dann geht es auch direkt
          aus der YouTube-App über <i>Teilen</i>, ohne diese Seite.
        </p>
      </li>
    </ol>
  </details>

  <footer>
    <p>Die MP4 landet in <i>Dateien → a-Shell → YouTube</i>. Von dort aus kannst du sie über <i>Teilen → Video sichern</i> in Fotos ablegen.</p>
    <p>
      Ohne ffmpeg lädt yt-dlp nur Formate, in denen Bild und Ton schon zusammen liegen, bei YouTube meist 360p.
      Mit <code class="mono">pkg install ffmpeg</code> in a-Shell sind höhere Auflösungen möglich. Ob yt-dlp das
      WebAssembly-ffmpeg dort nutzen kann, ist noch nicht getestet.
    </p>
    <p>Wenn Downloads plötzlich scheitern, hat YouTube meist etwas geändert. Dann in a-Shell <code class="mono">pip install -U yt-dlp</code> ausführen.</p>
  </footer>

  <div class="dock">
    {#if href}
      <a class="fab go" data-testid="mitschnitt-action" {href}>Laden</a>
    {:else}
      <button class="fab" type="button" data-testid="mitschnitt-action" disabled>Laden</button>
    {/if}
  </div>
</div>

<style>
  .mitschnitt {
    max-width: 620px; margin: 0 auto;
    padding: 28px var(--gutter-r) 0 var(--gutter);
    display: grid; gap: 22px;
    grid-template-columns: minmax(0, 1fr);
  }

  .head { display: grid; gap: 4px; }
  h2 { margin: 0; font-size: 34px; line-height: 1.1; font-weight: 600; letter-spacing: -0.025em; }
  .sub { margin: 0; font-size: 12px; color: var(--muted); }

  .card {
    display: grid; gap: 14px;
    padding: 14px 16px 16px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .meta {
    display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
    font-size: 12px; color: var(--muted);
    padding-bottom: 8px; border-bottom: 1.5px solid var(--accent);
  }
  .meta span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .field { display: flex; gap: 8px; min-width: 0; }
  input {
    flex: 1; min-width: 0;
    /* 16px keeps iOS Safari from zooming in on focus. */
    font: 16px/1.4 var(--mono); color: var(--ink);
    background: var(--paper); border: 1px solid var(--line); border-radius: 8px;
    padding: 11px 12px;
  }
  input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  input[aria-invalid="true"] { border-color: var(--warn); }
  .paste {
    border: 0; background: var(--accent-soft); color: var(--accent);
    border-radius: 8px; padding: 0 14px; font-size: 14px; font-weight: 600;
  }

  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    display: flex; align-items: baseline; gap: 6px;
    background: var(--paper); border: 1px solid var(--line); color: var(--ink);
    border-radius: 8px; padding: 9px 12px; font-size: 14px; font-weight: 500; line-height: 1.5;
  }
  .chip small { font-size: 11px; color: var(--muted); }
  .hint { align-self: center; font-size: 12px; color: var(--faint); }

  .setup { border-top: 1px solid var(--line); padding-top: 20px; }
  summary {
    font-size: 11px; line-height: 1.4; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer; padding: 6px 0;
  }
  .setup ol { margin: 12px 0 0; padding-left: 22px; display: grid; gap: 16px; }
  .setup li::marker { font-family: var(--mono); color: var(--accent); font-size: 13px; }
  .setup p { margin: 0 0 8px; font-size: 15px; }
  .cmd {
    display: flex; align-items: flex-start; gap: 8px;
    background: var(--card); border: 1px solid var(--line); border-radius: 6px;
    padding: 10px 10px 10px 12px;
  }
  .cmd code { flex: 1; min-width: 0; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; user-select: all; -webkit-user-select: all; }
  .copy {
    border: 0; background: var(--accent-soft); color: var(--accent);
    border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 600; white-space: nowrap;
  }

  footer { color: var(--muted); font-size: 13px; max-width: 62ch; }
  footer p { margin: 0 0 8px; }
  footer code { font-size: 12px; }

  /* Sticky, not fixed: see the deck contract in README.md. */
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
    display: inline-flex; align-items: center;
    height: 56px; padding: 0 34px; border: 0; border-radius: 28px;
    font-size: 17px; font-weight: 600; text-decoration: none;
    background: var(--ink); color: var(--paper);
  }
  .fab.go { background: var(--accent); color: var(--on-accent); }
  .fab:disabled { opacity: 0.35; }
</style>
