// The page only hands a YouTube link to an iOS Shortcut; the download itself
// runs in a-Shell (public/mitschnitt/ytmp4.py). Everything here is about
// turning whatever was pasted into one safe argument for that script.

// An id is 11 characters of [A-Za-z0-9_-]. Anything else in the pasted text
// (tracking parameters, timestamps, playlist ids) is dropped.
const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = /^(?:(?:www|m|music)\.)?youtube(?:-nocookie)?\.com$/;
const PATHS = /^\/(?:shorts|live|embed|v|e)\/([^/?#]+)/;

export const QUALITIES = { 360: '360p', 720: '720p', 1080: '1080p', best: 'Beste' };
// Tap order of the quality chip. Not Object.keys(QUALITIES): integer-like keys
// always come out sorted, whatever order the literal has.
export const QUALITY_ORDER = ['720', '1080', 'best', '360'];
export const SHORTCUT = 'ToolDeck YT';

// The video id in a YouTube link, or null. Accepts youtube.com/watch?v=,
// /shorts/, /live/, /embed/, youtu.be/ and bare ids; the scheme may be missing.
export function videoId(text) {
  const s = String(text ?? '').trim();
  if (ID.test(s)) return s;

  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (HOSTS.test(host)) id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(PATHS)?.[1];
  return id && ID.test(id) ? id : null;
}

// What the Shortcut passes on to ytmp4.py: the canonical link, with the height
// limit in the fragment so it stays a single argument.
export function target(id, quality) {
  const url = `https://www.youtube.com/watch?v=${id}`;
  return quality in QUALITIES && quality !== 'best' ? `${url}#h=${quality}` : url;
}

// Apple's documented URL scheme for running a Shortcut with text input.
export function shortcutUrl(text, name = SHORTCUT) {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(text)}`;
}
