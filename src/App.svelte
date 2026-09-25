<script>
  import { onMount } from 'svelte';
  import Home from './Home.svelte';
  import Icon from './Icon.svelte';
  import { tools } from './tools/index.js';

  const pad = (n) => String(n).padStart(2, '0');
  const indexOf = (hash) => tools.findIndex((t) => `#${t.id}` === hash);

  // The open tool (-1: the picker). `shown` is the tool the tool layer draws;
  // it stays set while the layer slides back out.
  const start = indexOf(location.hash);
  let current = $state(start);
  let shown = $state(start);
  let sel = $state(Math.max(0, start));
  // Page transitions are off until after the first frame, so a deep link
  // opens straight on its tool instead of sliding in.
  let animate = $state(false);
  // A tool is loaded the first time it is opened and stays mounted after.
  let opened = $state(start >= 0 ? { [tools[start].id]: true } : {});
  const modules = {};

  function load(tool) {
    modules[tool.id] ??= tool.load().then((m) => m.default);
    return modules[tool.id];
  }

  function show(index) {
    current = index;
    if (index >= 0) {
      shown = index;
      sel = index;
      opened[tools[index].id] = true;
    }
  }

  function open(index) {
    const hash = `#${tools[index].id}`;
    // Marked so that Back knows it can pop this entry to get home.
    if (location.hash !== hash) history.pushState({ fromHome: true }, '', hash);
    show(index);
  }

  function back() {
    if (history.state?.fromHome) {
      history.back();
    } else {
      // A deep link has nothing to go back to: go home in place.
      history.replaceState(null, '', location.pathname + location.search);
    }
    show(-1);
  }

  // Browser back/forward and a hash typed or set by hand.
  function sync() {
    const index = indexOf(location.hash);
    if (index !== current) show(index);
  }

  onMount(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => (animate = true)));
  });
</script>

<svelte:window onhashchange={sync} onpopstate={sync} />

<main class="shell" class:animate class:open={current >= 0}>
  <section class="home" aria-label="Tools" inert={current >= 0}>
    <Home {tools} bind:sel {open} />
  </section>

  <section class="layer" aria-label={shown >= 0 ? tools[shown].name : undefined} inert={current < 0}>
    <nav class="nav">
      <button type="button" class="back" onclick={back}><span aria-hidden="true">‹</span>Tools</button>
      <span class="count mono">{pad(Math.max(0, shown) + 1)} / {pad(tools.length)}</span>
    </nav>

    <div class="pages">
      {#each tools as tool, i (tool.id)}
        {#if opened[tool.id]}
          <div class="page" class:on={i === shown} data-tool={tool.id} inert={i !== current}>
            <header class="tool-head">
              <span class="tile"><Icon name={tool.icon} size={26} /></span>
              <div>
                <h1>{tool.name}</h1>
                <p class="sub mono">{tool.sub}</p>
              </div>
            </header>
            {#await load(tool)}
              <p class="loading mono">Loading {tool.name} …</p>
            {:then Tool}
              <Tool active={current === i} />
            {:catch}
              <!-- Browsers remember a failed module import by URL, so only a reload retries it. -->
              <p class="loading mono">
                {tool.name} could not be loaded. Offline?
                <button type="button" class="retry" onclick={() => location.reload()}>Reload</button>
              </p>
            {/await}
          </div>
        {/if}
      {/each}
    </div>
  </section>
</main>

<style>
  :global(#app) { height: 100dvh; }

  .shell { position: relative; height: 100%; overflow: hidden; }

  .home, .layer {
    position: absolute; inset: 0;
    background: var(--bg);
  }
  .animate .home, .animate .layer { transition: transform 0.42s var(--ease-page); }
  .open .home { transform: translateX(-30%); }
  .layer { transform: translateX(105%); display: grid; grid-template-rows: auto 1fr; }
  .open .layer { transform: none; }

  .nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: max(10px, env(safe-area-inset-top)) var(--gutter-r) 4px calc(var(--gutter) - 10px);
    background: var(--bg);
    border-bottom: 1px solid var(--raised);
  }
  .back {
    display: flex; align-items: center; gap: 4px;
    border: 0; background: none; padding: 8px 10px;
    color: var(--accent); font-size: 16px; font-weight: 500;
  }
  .back span { font-size: 24px; line-height: 16px; margin-top: -3px; }
  .count { font-size: 11px; color: var(--faint); }

  .pages { position: relative; min-height: 0; }
  .page {
    position: absolute; inset: 0;
    overflow-y: auto;
    /* Something too wide inside a tool must not scroll the page sideways. */
    overflow-x: clip;
    overscroll-behavior-y: contain;
    visibility: hidden;
    display: flex; flex-direction: column;
    --gutter: max(16px, env(safe-area-inset-left));
    --gutter-r: max(16px, env(safe-area-inset-right));
  }
  .page.on { visibility: visible; }

  .tool-head {
    display: flex; align-items: center; gap: 14px;
    width: 100%; max-width: 620px; margin: 0 auto;
    padding: 22px calc(var(--gutter-r) + 2px) 0 calc(var(--gutter) + 2px);
  }
  .tile {
    flex: none; width: 48px; height: 48px; border-radius: 13px;
    display: grid; place-items: center;
    background: var(--accent); color: var(--on-accent);
  }
  h1 { margin: 0; font-size: 30px; line-height: 1.1; font-weight: 600; letter-spacing: -0.025em; }
  .sub { margin: 2px 0 0; font-size: 12px; line-height: 1.4; color: var(--muted); }

  .retry {
    display: block; margin-top: 12px;
    border: 1px solid var(--line); background: var(--card);
    border-radius: 10px; padding: 8px 12px; font-size: 14px;
  }
  .loading { padding: 20px var(--gutter-r) 0 var(--gutter); color: var(--muted); font-size: 13px; }

  @media (prefers-reduced-motion: reduce) {
    .animate .home, .animate .layer { transition: none; }
  }
</style>
