# ToolDeck

## Design
Every UI change follows `docs/DESIGN.md` (tokens, typography, components, picker wheel, icons).
- Only use the colour and font variables from `src/app.css`, no new hex values in components.
- The app is dark only. No glass/blur, no gradients except the dock fade.
- Icons only from `public/icons/`; new icons follow the icon rules in DESIGN.md.
- Tool selection on the home page is the picker wheel (drum or dial, switchable via toggle).
- When unsure: keep it restrained, matte, typographic. The rust line is the signature element.
