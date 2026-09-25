import { describe, it, expect } from 'vitest';
import { videoId, target, shortcutUrl, QUALITIES, QUALITY_ORDER, SHORTCUT } from '../../src/tools/mitschnitt/youtube.js';

const ID = 'dQw4w9WgXcQ';

describe('videoId', () => {
  it.each([
    ID,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?feature=share&v=${ID}&t=42`,
    `http://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}&list=RD`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `  youtube.com/watch?v=${ID}  `,
    `youtu.be/${ID}`,
  ])('finds the id in %s', (link) => {
    expect(videoId(link)).toBe(ID);
  });

  it.each([
    '',
    null,
    'kein link',
    `https://example.com/watch?v=${ID}`,
    `https://youtube.com.evil.test/watch?v=${ID}`,
    `https://www.youtube.com/watch?v=${ID}x`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/channel/UC1234567890',
    `javascript:alert('${ID}')`,
    `https://youtu.be/${ID}'; rm -rf ~ '`,
  ])('rejects %s', (text) => {
    expect(videoId(text)).toBeNull();
  });
});

describe('target', () => {
  it('puts the height limit in the fragment', () => {
    expect(target(ID, '720')).toBe(`https://www.youtube.com/watch?v=${ID}#h=720`);
  });

  it('leaves it out for the best quality or an unknown value', () => {
    expect(target(ID, 'best')).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(target(ID, '999')).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });

  it('is shell-safe inside single quotes for every quality', () => {
    for (const q of Object.keys(QUALITIES)) expect(target(ID, q)).toMatch(/^[A-Za-z0-9:/?=#._-]+$/);
  });
});

describe('QUALITY_ORDER', () => {
  it('holds every quality once, lowest first, best last', () => {
    expect([...QUALITY_ORDER].sort()).toEqual(Object.keys(QUALITIES).sort());
    expect(QUALITY_ORDER).toEqual(['360', '720', '1080', 'best']);
  });
});

describe('shortcutUrl', () => {
  it('runs the named Shortcut with the text as input', () => {
    const url = new URL(shortcutUrl(target(ID, '1080')));
    expect(url.protocol).toBe('shortcuts:');
    expect(url.searchParams.get('name')).toBe(SHORTCUT);
    expect(url.searchParams.get('input')).toBe('text');
    expect(url.searchParams.get('text')).toBe(`https://www.youtube.com/watch?v=${ID}#h=1080`);
  });
});
