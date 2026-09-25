<script>
  import { onMount } from 'svelte';
  import Icon from '../Icon.svelte';

  let { tools, sel = $bindable(), open } = $props();

  const ROW = 52;
  const pad = (n) => String(n).padStart(2, '0');
  const today = new Date()
    .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .replaceAll('/', '.');

  let wheel;
  let top = $state(sel * ROW);

  // Each row tilts away and fades with its distance from the band, in rows.
  const rows = $derived(
    tools.map((_, i) => {
      const o = (i * ROW - top) / ROW;
      return { rx: Math.max(-80, Math.min(80, -o * 24)), op: Math.max(0.12, 1 - Math.abs(o) * 0.3) };
    }),
  );

  onMount(() => {
    wheel.scrollTop = sel * ROW;
    top = wheel.scrollTop;
  });

  function onscroll() {
    top = wheel.scrollTop;
    const i = Math.min(tools.length - 1, Math.max(0, Math.round(top / ROW)));
    if (i !== sel) sel = i;
  }

  function tap(i) {
    if (i === sel) open(i);
    else wheel.scrollTo({ top: i * ROW, behavior: 'smooth' });
  }
</script>

<div class="drum">
  <div class="meta mono"><span>{today}</span><span>{pad(sel + 1)} / {pad(tools.length)}</span></div>

  <div class="frame">
    <div class="band" aria-hidden="true"></div>
    <div class="wheel" bind:this={wheel} {onscroll} data-testid="drum">
      <div class="spacer"></div>
      {#each tools as tool, i (tool.id)}
        <button
          type="button"
          class="row"
          class:sel={i === sel}
          aria-current={i === sel ? 'true' : undefined}
          style:transform="rotateX({rows[i].rx}deg)"
          style:opacity={rows[i].op}
          onclick={() => tap(i)}
        >
          <span class="icon"><Icon name={tool.icon} /></span>
          <span class="name">{tool.name}</span>
          <span class="num mono">{pad(i + 1)}</span>
        </button>
      {/each}
      <div class="spacer"></div>
    </div>
  </div>

  <div class="foot">
    <div class="text">
      <span class="blurb">{tools[sel].blurb}</span>
      <span class="note mono">{tools[sel].note}</span>
    </div>
    <button type="button" class="open" onclick={() => open(sel)}>Open {tools[sel].name}</button>
  </div>
</div>

<style>
  .drum {
    flex: 1; min-height: 0;
    display: flex; flex-direction: column;
    padding-top: 28px;
    overflow-y: auto;
  }
  .meta {
    display: flex; justify-content: space-between;
    padding: 0 var(--gutter-r) 0 var(--gutter);
    font-size: 12px; color: var(--faint);
  }

  .frame { position: relative; flex: none; height: 364px; margin-top: 20px; }
  .band {
    position: absolute; left: 12px; right: 12px; top: 156px; height: 52px;
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
    box-shadow: inset 0 -1.5px 0 var(--accent);
  }
  .wheel {
    position: absolute; inset: 0;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    scrollbar-width: none;
    perspective: 700px;
    -webkit-mask-image: linear-gradient(transparent, #000 30%, #000 70%, transparent);
    mask-image: linear-gradient(transparent, #000 30%, #000 70%, transparent);
  }
  .wheel::-webkit-scrollbar { display: none; }
  .spacer { height: 156px; }

  .row {
    width: 100%; height: 52px;
    display: flex; align-items: center; gap: 14px;
    padding: 0 32px; border: 0; background: none;
    scroll-snap-align: center;
    color: var(--muted);
  }
  .row.sel { color: var(--ink); }
  .icon { display: flex; color: var(--faint); }
  .row.sel .icon { color: var(--accent); }
  .name { flex: 1; min-width: 0; text-align: left; font-size: 22px; font-weight: 600; letter-spacing: -0.015em; }
  .num { font-size: 12px; color: var(--faint); }

  .foot {
    margin-top: auto;
    padding: 20px var(--gutter-r) max(28px, env(safe-area-inset-bottom)) var(--gutter);
    display: flex; flex-direction: column; gap: 18px;
  }
  .text { display: flex; flex-direction: column; gap: 4px; min-height: 70px; }
  .blurb { font-size: 22px; line-height: 1.3; font-weight: 500; letter-spacing: -0.01em; }
  .note { font-size: 12px; color: var(--muted); }
  .open {
    height: 56px; border: 0; border-radius: 28px;
    background: var(--accent); color: var(--on-accent);
    font-size: 17px; font-weight: 600;
  }
  .open:active { transform: scale(0.98); }
</style>
