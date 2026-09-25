<script>
  // An icon from public/icons/, drawn in currentColor. The SVG is used as a
  // mask over a box filled with the text colour, so the files stay the single
  // source and still follow the colour of whatever they sit in.
  let { name, size = 24 } = $props();
</script>

<i
  class="icon"
  aria-hidden="true"
  style:--src="url({import.meta.env.BASE_URL}icons/{name}.svg)"
  style:width="{size}px"
  style:height="{size}px"
></i>

<style>
  .icon {
    display: inline-block; flex: none;
    background: currentColor;
    -webkit-mask: var(--src) center / contain no-repeat;
    mask: var(--src) center / contain no-repeat;
  }
</style>
