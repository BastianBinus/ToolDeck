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

  // The page that covers most of the deck is the current one. Worked out from
  // the scroll position rather than IntersectionObserver, whose isIntersecting
  // WebKit reports true for pages that merely touch the edge.
  function onScroll() {
    const index = Math.round(deck.scrollLeft / deck.clientWidth);
    if (index !== current && index >= 0 && index < pages.length) current = index;
  }

  function onHash() {
    const index = pages.findIndex((p) => `#${p.id}` === location.hash);
    go(Math.max(0, index));
  }

  onMount(() => {
    if (start > 0) go(start, false);

    // Rotating the phone changes the page width; keep the same page in view.
    const ro = new ResizeObserver(() => go(current, false));
    ro.observe(deck);

    return () => ro.disconnect();
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

<svelte:window onhashchange={onHash} />

<main class="deck" bind:this={deck} onscroll={onScroll}>
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
          <!-- Browsers remember a failed module import by URL, so only a reload retries it. -->
          <p class="loading mono">
            {tool.name} konnte nicht geladen werden. Offline?
            <button type="button" class="retry" onclick={() => location.reload()}>Neu laden</button>
          </p>
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
    width: 22px; height: 44px; border: 0; padding: 0; background: none;
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
    /* Something too wide inside a tool must not turn the page into a second
       horizontal scroller competing with the deck. */
    overflow-x: clip;
    overscroll-behavior-y: contain;
    scroll-snap-align: start;
    /* One page per swipe, even on a hard fling. */
    scroll-snap-stop: always;
  }

  .retry {
    display: block; margin-top: 12px;
    border: 1px solid var(--line); background: var(--card);
    border-radius: 8px; padding: 8px 12px; font-size: 14px;
  }
  .loading { padding: 28px var(--gutter-r) 0 var(--gutter); color: var(--muted); font-size: 13px; }

  @media (prefers-reduced-motion: reduce) {
    .tick::after { transition: none; }
  }
</style>
