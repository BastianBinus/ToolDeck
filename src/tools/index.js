// Every tool is one entry here plus a folder next to this file. The picker on
// the home page is built from this list, in this order.
//
// `icon` names a file in public/icons/. `sub` is the mono subtitle on the
// tool's own page.
//
// A tool's component receives one prop, `active`: true while its page is the
// one on screen. The app keeps a tool mounted once it has been opened, so its
// state survives going back to the picker. What costs memory (workers, models,
// big buffers) the tool frees itself when `active` turns false and it is not
// busy — iOS reloads the whole page when one tab uses too much.
export const tools = [
  {
    id: 'tonspur',
    name: 'Tonspur',
    blurb: 'Video or audio → text',
    note: 'Whisper, on device',
    sub: 'Video → text · on device',
    icon: 'tonspur',
    load: () => import('./tonspur/Tonspur.svelte'),
  },
  {
    id: 'mitschnitt',
    name: 'Mitschnitt',
    blurb: 'YouTube → MP4',
    note: 'yt-dlp in a-Shell, via Shortcut',
    sub: 'YouTube → MP4 · via a-Shell',
    icon: 'mitschnitt',
    load: () => import('./mitschnitt/Mitschnitt.svelte'),
  },
];
