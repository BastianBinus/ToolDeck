<script>
  import Icon from '../Icon.svelte';

  let { tools, sel = $bindable(), open } = $props();

  const SIZE = 380;
  const RADIUS = 132;
  // The tool list is fixed for the life of the app.
  // svelte-ignore state_referenced_locally
  const STEP = 360 / tools.length;
  const pad = (n) => String(n).padStart(2, '0');
  const ticks = Array.from({ length: 72 }, (_, k) => ({ a: k * 5, long: k % 3 === 0, strong: k % 18 === 0 }));

  // The disc's rotation in degrees. Tool i sits at i * STEP, so it is under the
  // marker when rot = -i * STEP (plus any number of full turns).
  let rot = $state(-sel * STEP);
  let dragging = $state(false);
  let width = $state(SIZE + 10);
  // Narrow screens get a smaller disc rather than a sideways scroll.
  const scale = $derived(Math.min(1, (width - 10) / SIZE));

  let disc;
  let last = 0;
  let total = 0;
  let down = false;
  let moved = false;
  let wheelTimer;

  const norm = (i) => ((i % tools.length) + tools.length) % tools.length;
  const selFrom = (r) => norm(Math.round(-r / STEP));

  function turn(to) {
    rot = to;
    const i = selFrom(to);
    if (i !== sel) sel = i;
  }

  function snap() {
    dragging = false;
    turn(Math.round(rot / STEP) * STEP);
  }

  // Angle of the pointer around the disc's centre, 0 at the top, clockwise.
  function angle(e) {
    const r = disc.getBoundingClientRect();
    return (Math.atan2(e.clientX - r.left - r.width / 2, -(e.clientY - r.top - r.height / 2)) * 180) / Math.PI;
  }

  function onpointerdown(e) {
    last = angle(e);
    total = 0;
    moved = false;
    down = true;
  }

  function onpointermove(e) {
    if (!down) return;
    const a = angle(e);
    let d = a - last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    last = a;
    total += d;
    // Only a real turn takes the pointer; below that it is still a tap.
    if (!moved && Math.abs(total) > 4) {
      moved = true;
      dragging = true;
      try { disc.setPointerCapture(e.pointerId); } catch {}
    }
    if (moved) turn(rot + d);
  }

  function onpointerup() {
    if (!down) return;
    down = false;
    if (moved) {
      snap();
      // The click that ends a drag must not also select or open.
      setTimeout(() => (moved = false), 0);
    }
  }

  function onwheel(e) {
    e.preventDefault();
    dragging = true;
    turn(rot - e.deltaY * 0.3);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(snap, 140);
  }

  function tap(i) {
    if (moved) return;
    if (i === sel) return open(i);
    // Turn the short way round to the tapped tool.
    const base = -i * STEP;
    turn(base + Math.round((rot - base) / 360) * 360);
  }

  function onkeydown(e) {
    const d = { ArrowLeft: 1, ArrowUp: 1, ArrowRight: -1, ArrowDown: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    turn(Math.round(rot / STEP) * STEP + d * STEP);
  }
</script>

<div class="dial">
  <div class="info">
    <div class="meta mono"><span class="note">{tools[sel].note}</span><span>{pad(sel + 1)} / {pad(tools.length)}</span></div>
    <h2>{tools[sel].name}</h2>
    <p>{tools[sel].blurb}</p>
  </div>

  <div class="well" bind:clientWidth={width}>
    <div class="holder" style:transform="translateX(-50%) scale({scale})">
      <i class="marker" aria-hidden="true"></i>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="disc"
        class:dragging
        bind:this={disc}
        data-testid="dial"
        {onpointerdown}
        {onpointermove}
        {onpointerup}
        onpointercancel={onpointerup}
        {onwheel}
        {onkeydown}
      >
        <div class="rotor" style:transform="rotate({rot}deg)">
          {#each ticks as t (t.a)}
            <i class="tick" class:long={t.long} class:strong={t.strong} style:transform="rotate({t.a}deg)"></i>
          {/each}
          {#each tools as tool, i (tool.id)}
            {@const a = (i * STEP * Math.PI) / 180}
            <button
              type="button"
              class="item"
              class:sel={i === sel}
              aria-label={tool.name}
              aria-current={i === sel ? 'true' : undefined}
              style:left="{SIZE / 2 + RADIUS * Math.sin(a)}px"
              style:top="{SIZE / 2 - RADIUS * Math.cos(a)}px"
              style:transform="rotate({-rot}deg)"
              onclick={() => tap(i)}
            >
              <Icon name={tool.icon} size={26} />
            </button>
          {/each}
        </div>
        <button type="button" class="open" aria-label="Open {tools[sel].name}" onclick={() => open(sel)}>Open</button>
      </div>
    </div>
  </div>
</div>

<style>
  .dial { flex: 1; min-height: 0; display: flex; flex-direction: column; }

  .info {
    flex: none;
    display: flex; flex-direction: column; gap: 10px;
    padding: 44px calc(var(--gutter-r) + 4px) 0 calc(var(--gutter) + 4px);
  }
  .meta {
    display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
    padding-bottom: 10px; border-bottom: 1.5px solid var(--accent);
    font-size: 12px; color: var(--faint);
  }
  .note { color: var(--accent); }
  h2 { margin: 6px 0 0; font-size: 46px; line-height: 1.02; font-weight: 600; letter-spacing: -0.035em; }
  p { margin: 0; font-size: 18px; line-height: 1.4; color: var(--muted); }

  /* The disc sticks out below the screen; only its upper part shows. */
  .well { position: relative; flex: 1; min-height: 300px; overflow: hidden; }
  .holder {
    position: absolute; left: 50%; bottom: -36px;
    width: 380px; height: 380px;
    transform-origin: 50% 100%;
  }
  .marker {
    position: absolute; left: 50%; top: -22px; margin-left: -6px;
    border-left: 6px solid transparent; border-right: 6px solid transparent;
    border-top: 9px solid var(--accent);
  }
  .disc {
    position: absolute; inset: 0;
    border-radius: 50%;
    background: var(--card); border: 1px solid var(--line);
    box-shadow: 0 -20px 50px -20px rgb(0 0 0 / 0.6);
    touch-action: none; cursor: grab;
  }
  .rotor { position: absolute; inset: -1px; transition: transform 0.45s cubic-bezier(0.3, 1.3, 0.5, 1); }
  .dragging .rotor, .dragging .item { transition: none; }

  .tick {
    position: absolute; left: 189px; top: 6px;
    width: 2px; height: 5px; border-radius: 1px;
    background: var(--line);
    transform-origin: 1px 184px;
  }
  .tick.long { height: 10px; }
  .tick.strong { background: var(--faint); }

  .item {
    position: absolute; width: 64px; height: 64px; margin: -32px 0 0 -32px;
    border-radius: 32px; border: 1px solid var(--line);
    display: grid; place-items: center;
    background: var(--raised); color: var(--muted);
    transition: transform 0.45s cubic-bezier(0.3, 1.3, 0.5, 1), background 0.2s, color 0.2s;
  }
  .item.sel { background: var(--ink); border-color: var(--ink); color: var(--on-accent); }

  .open {
    position: absolute; left: 50%; top: 50%; width: 120px; height: 120px; margin: -60px 0 0 -60px;
    border: 0; border-radius: 60px;
    background: var(--accent); color: var(--on-accent);
    font-size: 17px; font-weight: 600;
  }
  .open:active { transform: scale(0.96); }

  @media (prefers-reduced-motion: reduce) {
    .rotor, .item { transition: none; }
  }
</style>
