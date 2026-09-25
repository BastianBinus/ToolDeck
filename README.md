# ToolDeck

A personal collection of small tools for the iPhone. They run entirely in the browser, with no account, paywall or upload.
It is a PWA: open it in Safari, then *Share → Add to Home Screen*.

The home page is a picker wheel (drum or dial, switched with the toggle at the top right). Opening a tool slides its page in;
*‹ Tools* goes back. Each tool also has its own address (`#tonspur`, `#mitschnitt`), so deep links and the browser's back button work.

| No. | Tool | What |
|---|---|---|
| 01 | Tonspur | Video/audio → text with Whisper on the device ([original](https://github.com/BastianBinus/Tonspur)) |
| 02 | Mitschnitt | YouTube → MP4. Starts a Shortcut that runs yt-dlp in [a-Shell](https://github.com/holzschu/a-shell) |

The design (tokens, typography, components, picker, icons) is in [`docs/DESIGN.md`](docs/DESIGN.md).

## Development

```sh
npm install
npm run dev          # http://localhost:5173/ToolDeck/
npm run build        # to dist/
npm run test:unit    # Vitest
npm run test:e2e     # Playwright (builds and starts vite preview itself)
npm run test:all
python3 -m unittest discover -s tests/python   # ytmp4.py (Mitschnitt)
```

Stack: Vite 8, Svelte 5, vite-plugin-pwa (Workbox). Deployed to GitHub Pages by an Action on push to `main`
(set *Pages → Source: GitHub Actions* once in the repo settings). For another host, build with `BASE=/ npm run build`.

## Adding a tool

1. Create a folder `src/tools/<id>/` with a Svelte component.
2. Add an entry to `src/tools/index.js` (`id`, `name`, `blurb`, `note`, `sub`, `icon`, `load`).
3. Add its icon to `public/icons/<icon>.svg`, following the icon rules in `docs/DESIGN.md`.

The app draws the tool's header (icon tile, name, `sub`); the component starts below it.

Contract for every component:

- It receives the prop `active`. When it is `true`, the tool's page is on screen.
- After it is first opened it stays mounted, so its state survives going back to the picker.
- It frees memory hogs such as workers, models or large buffers itself as soon as `active` turns `false` and nothing is running.
  Otherwise iOS reloads the whole tab.
- No `position: fixed`: every opened tool stays mounted in its own page. Use `position: sticky` for bars at the bottom.
- Only use the colour and font variables from `src/app.css`. The app is dark only.

## Known limits

- The e2e tests run in Chromium with an iPhone viewport. They do not test real WebKit/iOS Safari.
- Tonspur loads transformers.js from jsDelivr and the models from Hugging Face. Both are cached on the first run and work offline after that.
- Updates only apply once the app has been closed completely (app switcher → swipe away). An open app deliberately does not take over
  a new version, because the files of its lazily loaded tools would otherwise disappear.
- Tonspur runs single-threaded because GitHub Pages cannot send COOP/COEP headers.
- Mitschnitt does not download in the browser. Safari cannot reach the YouTube streams because of CORS, and YouTube now requires PO tokens.
  The page only calls the Shortcut `ToolDeck YT`, which starts `public/mitschnitt/ytmp4.py` in a-Shell. The setup is described on the page.
- Without ffmpeg, yt-dlp in a-Shell only gets formats with picture and sound already combined (usually 360p on YouTube). Whether
  yt-dlp uses the WebAssembly ffmpeg from `pkg install ffmpeg` is not tested. yt-dlp has to be updated now and then with `pip install -U yt-dlp`.
