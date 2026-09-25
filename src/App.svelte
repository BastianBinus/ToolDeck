<script>
  import { onMount } from 'svelte';
  import Home from './Home.svelte';
  import { tools } from './tools/index.js';

  // Page 0 is the home page, page i is tools[i - 1].
  const pages = [{ id: 'home', name: 'Übersicht' }, ...tools];

  let deck;
  // Read the deep link before the hash-writing effect below first runs.
  const start = Math.max(0, pages.findIndex((p) => `#${p.id}` === location.hash));
  let current = $state(start);
  // A tool is loaded the first time its page comes up and stays mounted after.
  let opened = $state({});
  const modules = {};

  function load(tool) {
    modules[tool.id] ??= tool.load().then((m) => m.default);
    return modules[tool.id];
  }

  function go(index, smooth = true) {
    deck.scrollTo({ left: index * deck.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
  }

  $effect(() => {
    const page = pages[current];
    if (current > 0) opened[page.id] = true;
    const hash = current === 0 ? '' : `#${page.id}`;
    if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
  });

  onMount(() => {
    if (start > 0) go(start, false);

    // The page that covers most of the deck is the current one. Scroll-snap
    // settles on exactly one, so the threshold only has to be above half.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) current = Number(e.target.dataset.index);
      },
      { root: deck, threshold: 0.6 },
    );
    for (const el of deck.children) io.observe(el);

    // Rotating the phone changes the page width; keep the same page in view.
    const ro = new ResizeObserver(() => go(current, false));
    ro.observe(deck);

    return () => {
      io.disconnect();
      ro.disconnect();
    };
  });
</script>

<header class="bar">
  <button class="brand" type="button" onclick={() => go(0)} aria-label="Zur Übersicht">
    <svg class="mark" viewBox="0 0 20 16" aria-hidden="true"><rect x="5.5" y="1" width="13.5" height="10" rx="1.5"/><rect x="1" y="5" width="13.5" height="10" rx="1.5"/></svg>ToolDeck
  </button>
  <nav class="ticks" aria-label="Seiten">
    <span class="label mono">{String(current).padStart(2, '0')} · {pages[current].name}</span>
    {#each pages as page, i (page.id)}
      <button
        type="button"
        class="tick"
        class:on={i === current}
        aria-label={page.name}
        aria-current={i === current ? 'page' : undefined}
        onclick={() => go(i)}
      ></button>
    {/each}
  </nav>
</header>

<main class="deck" bind:this={deck}>
  <section class="page" data-index="0" aria-label="Übersicht" inert={current !== 0}>
    <Home {tools} open={(i) => go(i + 1)} />
  </section>

  {#each tools as tool, i (tool.id)}
    <section class="page" data-index={i + 1} aria-label={tool.name} inert={current !== i + 1}>
      {#if opened[tool.id]}
        {#await load(tool)}
          <p class="loading mono">Lade {tool.name} …</p>
        {:then Tool}
          <Tool active={current === i + 1} />
        {:catch}
          <p class="loading mono">{tool.name} konnte nicht geladen werden. Offline?</p>
        {/await}
      {/if}
    </section>
  {/each}
</main>

<style>
  :global(#app) {
    height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr;
  }

  .bar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: max(10px, env(safe-area-inset-top)) var(--gutter-r) 10px var(--gutter);
    border-bottom: 1px solid var(--line);
    background: var(--paper);
  }
  .brand {
    display: flex; align-items: center; gap: 9px;
    border: 0; background: none; padding: 6px 0;
    font-size: 16px; font-weight: 600; letter-spacing: -0.01em;
  }
  .mark { width: 20px; height: 16px; fill: var(--paper); stroke: var(--ink); stroke-width: 1.5; }
  .ticks { display: flex; align-items: center; gap: 2px; min-width: 0; }
  .label {
    font-size: 11px; color: var(--muted); margin-right: 8px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tick {
    width: 22px; height: 32px; border: 0; padding: 0; background: none;
    display: grid; place-items: center;
  }
  .tick::after {
    content: ""; width: 14px; height: 3px; border-radius: 2px;
    background: var(--line); transition: background 0.2s;
  }
  .tick.on::after { background: var(--ink); }

  .deck {
    display: flex;
    overflow-x: auto; overflow-y: hidden;
    scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  .deck::-webkit-scrollbar { display: none; }

  .page {
    flex: 0 0 100%;
    min-width: 0;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    scroll-snap-align: start;
    /* One page per swipe, even on a hard fling. */
    scroll-snap-stop: always;
  }

  .loading { padding: 28px var(--gutter-r) 0 var(--gutter); color: var(--muted); font-size: 13px; }

  @media (prefers-reduced-motion: reduce) {
    .tick::after { transition: none; }
  }
</style>
