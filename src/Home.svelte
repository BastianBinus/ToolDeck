<script>
  let { tools, open } = $props();

  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
</script>

<div class="home">
  <div class="head">
    <h1>Werkzeuge</h1>
    <span class="date mono">{today}</span>
  </div>

  <ol class="index">
    <li class="rule mono" aria-hidden="true"><span>Nr.</span><span>Werkzeug</span></li>
    {#each tools as tool, i (tool.id)}
      <li>
        <button type="button" class="card" onclick={() => open(i)}>
          <span class="num mono">{String(i + 1).padStart(2, '0')}</span>
          <span class="text">
            <span class="name">{tool.name}</span>
            <span class="blurb">{tool.blurb}</span>
            <span class="note mono">{tool.note}</span>
          </span>
          <span class="arrow" aria-hidden="true">→</span>
        </button>
      </li>
    {/each}
  </ol>

  <p class="foot">
    Alles läuft auf diesem Gerät, nichts wird hochgeladen. Nach links wischen, um durch die Werkzeuge zu blättern.
  </p>
</div>

<style>
  .home {
    max-width: 620px; margin: 0 auto;
    padding: 28px var(--gutter-r) max(40px, env(safe-area-inset-bottom)) var(--gutter);
    display: grid; gap: 22px;
  }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  h1 { margin: 0; font-size: 34px; line-height: 1.1; font-weight: 600; letter-spacing: -0.025em; }
  .date { font-size: 12px; color: var(--muted); }

  .index {
    list-style: none; margin: 0; padding: 0;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 6px;
    box-shadow: 0 1px 0 var(--line), 0 10px 24px -18px rgb(0 0 0 / 0.35);
  }
  /* The red header rule of an index card. */
  .rule {
    display: grid; grid-template-columns: 44px 1fr;
    padding: 12px 16px 8px;
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint);
    border-bottom: 1.5px solid var(--accent);
  }
  li + li:not(.rule) { border-top: 1px solid var(--line); }
  li.rule + li { border-top: 0; }

  .card {
    width: 100%;
    display: grid; grid-template-columns: 44px 1fr auto; align-items: start; gap: 0;
    padding: 16px; border: 0; background: none; text-align: left;
  }
  .card:active { background: var(--paper); }
  .num { font-size: 13px; color: var(--accent); padding-top: 3px; }
  .text { display: grid; gap: 2px; min-width: 0; }
  .name { font-size: 19px; font-weight: 600; letter-spacing: -0.01em; }
  .blurb { color: var(--muted); font-size: 15px; }
  .note { color: var(--faint); font-size: 11px; margin-top: 4px; }
  .arrow { font-size: 20px; color: var(--muted); padding-top: 1px; }

  .foot { margin: 0; color: var(--muted); font-size: 13px; max-width: 52ch; }
</style>
