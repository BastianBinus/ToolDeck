<script>
  import Icon from './Icon.svelte';
  import Drum from './picker/Drum.svelte';
  import Dial from './picker/Dial.svelte';

  let { tools, sel = $bindable(), open } = $props();

  const KEY = 'tooldeck.picker';
  let mode = $state(read() === 'dial' ? 'dial' : 'drum');

  function read() { try { return localStorage.getItem(KEY); } catch { return null; } }
  function pick(next) {
    mode = next;
    try { localStorage.setItem(KEY, next); } catch {}
  }
</script>

<div class="home">
  <header class="bar">
    <h1 class="brand">
      <svg class="mark" viewBox="0 0 20 16" aria-hidden="true"><rect x="5.5" y="1" width="13.5" height="10" rx="1.5"/><rect x="1" y="5" width="13.5" height="10" rx="1.5"/></svg>ToolDeck
    </h1>
    <div class="toggle" role="group" aria-label="Picker">
      {#each [['drum', 'Drum'], ['dial', 'Dial']] as [key, label] (key)}
        <button type="button" aria-label={label} aria-pressed={mode === key} class:on={mode === key} onclick={() => pick(key)}>
          <Icon name="picker-{key}" size={18} />
        </button>
      {/each}
    </div>
  </header>

  {#if mode === 'drum'}
    <Drum {tools} bind:sel {open} />
  {:else}
    <Dial {tools} bind:sel {open} />
  {/if}
</div>

<style>
  .home {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .bar {
    flex: none;
    display: flex; align-items: center; justify-content: space-between;
    padding: max(12px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 0 var(--gutter);
  }
  .brand {
    display: flex; align-items: center; gap: 9px; margin: 0;
    font-size: 16px; font-weight: 600; line-height: 1.5;
  }
  .mark { width: 20px; height: 16px; fill: var(--bg); stroke: var(--ink); stroke-width: 1.5; }

  .toggle {
    display: flex; gap: 2px; padding: 3px;
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
  }
  .toggle button {
    width: 40px; height: 32px; border: 0; border-radius: 9px;
    display: grid; place-items: center;
    background: transparent; color: var(--muted);
  }
  .toggle button.on { background: var(--ink); color: var(--on-accent); }
</style>
