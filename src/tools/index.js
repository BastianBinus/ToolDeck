// Every tool is one entry here plus a folder next to this file. The home page
// and the deck are built from this list, in this order.
//
// A tool's component receives one prop, `active`: true while its page is the
// one on screen. The deck keeps a tool mounted once it has been opened, so its
// state survives swiping away. What costs memory (workers, models, big buffers)
// the tool frees itself when `active` turns false and it is not busy — iOS
// reloads the whole page when one tab uses too much.
export const tools = [
  {
    id: 'tonspur',
    name: 'Tonspur',
    blurb: 'Video oder Audio → Text',
    note: 'Whisper, auf dem Gerät',
    load: () => import('./tonspur/Tonspur.svelte'),
  },
  {
    id: 'mitschnitt',
    name: 'Mitschnitt',
    blurb: 'YouTube → MP4',
    note: 'yt-dlp in a-Shell, per Kurzbefehl',
    load: () => import('./mitschnitt/Mitschnitt.svelte'),
  },
];
