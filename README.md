# ToolDeck

Eine persönliche Sammlung kleiner Werkzeuge fürs iPhone. Sie laufen komplett im Browser, ohne Konto, Paywall oder Upload.
Das Ganze ist eine PWA: in Safari öffnen, dann *Teilen → Zum Home-Bildschirm*.

Die Startseite ist Seite 0, rechts daneben liegt jedes Werkzeug als eigene Seite (horizontal wischen).

| Nr. | Werkzeug | Was |
|---|---|---|
| 01 | Tonspur | Video/Audio → Text mit Whisper auf dem Gerät ([Original](https://github.com/BastianBinus/Tonspur)) |
| 02 | Mitschnitt | YouTube → MP4. Startet einen Kurzbefehl, der yt-dlp in [a-Shell](https://github.com/holzschu/a-shell) ausführt |

## Entwicklung

```sh
npm install
npm run dev          # http://localhost:5173/ToolDeck/
npm run build        # nach dist/
npm run test:unit    # Vitest
npm run test:e2e     # Playwright (baut und startet vite preview selbst)
npm run test:all
python3 -m unittest discover -s tests/python   # ytmp4.py (Mitschnitt)
```

Stack: Vite 8, Svelte 5, vite-plugin-pwa (Workbox). Deploy über GitHub Pages per Action bei Push auf `main`
(einmalig in den Repo-Settings *Pages → Source: GitHub Actions* setzen). Für einen anderen Host mit `BASE=/ npm run build` bauen.

## Ein Werkzeug hinzufügen

1. Ordner `src/tools/<id>/` mit einer Svelte-Komponente anlegen.
2. Eintrag in `src/tools/index.js` (`id`, `name`, `blurb`, `note`, `load`).

Vertrag für jede Komponente:

- Sie bekommt die Prop `active`. Ist sie `true`, liegt die Seite gerade im Bild.
- Nach dem ersten Öffnen bleibt sie gemountet, ihr Zustand überlebt also das Wegwischen.
- Speicherfresser wie Worker, Modelle oder große Buffer gibt sie selbst frei, sobald `active` auf `false` fällt und nichts läuft. iOS lädt sonst den ganzen Tab neu.
- Kein `position: fixed`, denn die Seiten liegen nebeneinander. Für Leisten unten `position: sticky` nehmen.
- Nur die Farb- und Schrift-Variablen aus `src/app.css` verwenden, dann funktioniert Hell/Dunkel automatisch.

## Bekannte Grenzen

- Die e2e-Tests laufen in Chromium mit iPhone-Viewport. Echtes WebKit/iOS-Safari testen sie nicht.
- Tonspur lädt transformers.js von jsDelivr und die Modelle von Hugging Face. Beides wird beim ersten Lauf gecacht, danach läuft es offline.
- Updates greifen erst, wenn die App komplett geschlossen wurde (App-Umschalter → wegwischen). Eine offene App übernimmt eine neue Version absichtlich nicht, weil sonst die Dateien ihrer lazy geladenen Werkzeuge verschwinden würden.
- Tonspur läuft single-threaded, weil GitHub Pages keine COOP/COEP-Header senden kann.
- Mitschnitt lädt nicht im Browser. Safari kommt wegen CORS nicht an die YouTube-Streams, und YouTube verlangt inzwischen PO-Tokens.
  Die Seite ruft nur den Kurzbefehl `ToolDeck YT` auf, der `public/mitschnitt/ytmp4.py` in a-Shell startet. Die Einrichtung steht auf der Seite.
- Ohne ffmpeg bekommt yt-dlp in a-Shell nur Formate, in denen Bild und Ton schon zusammen liegen (bei YouTube meist 360p). Ob das
  WebAssembly-ffmpeg aus `pkg install ffmpeg` von yt-dlp genutzt wird, ist nicht getestet. yt-dlp muss ab und zu mit `pip install -U yt-dlp` aktualisiert werden.
