import { test, expect } from '@playwright/test';
import { tools } from '../../src/tools/index.js';
import { deck, scrollDeckTo, installFakeWorker } from './helpers.js';

const label = (page) => page.locator('header .label');
const tonspurPage = (page) => page.locator('section.page[data-index="1"]');

// The page at `index` fills the deck: its left edge sits at the deck's left edge.
async function expectOnPage(page, index) {
  await expect
    .poll(() =>
      deck(page).evaluate((el, i) => {
        const page = el.children[i].getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return Math.abs(page.left - box.left) <= 1 && Math.abs(el.scrollLeft - i * el.clientWidth) <= 1;
      }, index),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  // Keeps Tonspur from starting the real worker if a test happens to reach it.
  await installFakeWorker(page);
});

test('home lists every tool and loads without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => msg.type() === 'error' && errors.push(`console: ${msg.text()}`));

  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Werkzeuge' })).toBeVisible();

  const cards = page.locator('.index button.card');
  await expect(cards).toHaveCount(tools.length);
  for (const [i, tool] of tools.entries()) {
    await expect(cards.nth(i)).toContainText(tool.name);
    await expect(cards.nth(i)).toContainText(tool.blurb);
  }
  await expect(cards.filter({ hasText: 'Tonspur' })).toHaveCount(1);

  await expect(label(page)).toHaveText('00 · Übersicht');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('tapping the Tonspur card scrolls to its page and sets the hash', async ({ page }) => {
  await page.goto('./');
  await page.locator('.index button.card', { hasText: 'Tonspur' }).tap();

  await expectOnPage(page, 1);
  await expect(page).toHaveURL(/#tonspur$/);
  await expect(label(page)).toHaveText('01 · Tonspur');
  await expect(tonspurPage(page)).not.toHaveAttribute('inert');
  await expect(page.locator('section.page[data-index="0"]')).toHaveAttribute('inert');
});

test('deep link #tonspur opens directly on the Tonspur page', async ({ page }) => {
  await page.goto('./#tonspur');
  await expectOnPage(page, 1);
  await expect(label(page)).toHaveText('01 · Tonspur');
  await expect(page).toHaveURL(/#tonspur$/);
  await expect(page.getByTestId('tonspur-action')).toBeVisible();
});

test('the ToolDeck button returns home and clears the hash', async ({ page }) => {
  await page.goto('./#tonspur');
  await expectOnPage(page, 1);

  const brand = page.locator('header button.brand');
  await expect(brand).toHaveText('ToolDeck');
  await brand.tap();

  await expectOnPage(page, 0);
  await expect(label(page)).toHaveText('00 · Übersicht');
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
  expect(new URL(page.url()).pathname).toBe('/ToolDeck/');
});

test('scrolling the deck (a finished swipe) updates the current page', async ({ page }) => {
  await page.goto('./');
  await expect(label(page)).toHaveText('00 · Übersicht');

  await scrollDeckTo(page, 1);
  await expect(label(page)).toHaveText('01 · Tonspur');
  await expect(page).toHaveURL(/#tonspur$/);
  await expect(page.locator('header .tick').nth(1)).toHaveAttribute('aria-current', 'page');

  await scrollDeckTo(page, 0);
  await expect(label(page)).toHaveText('00 · Übersicht');
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
});

test('a real touch swipe to the left moves to the next page', async ({ page }) => {
  await page.goto('./');
  await expect(label(page)).toHaveText('00 · Übersicht');

  // Drive a touch drag through the compositor: touchStart, moves, touchEnd.
  const cdp = await page.context().newCDPSession(page);
  const box = await deck(page).boundingBox();
  const y = Math.round(box.y + box.height * 0.6);
  const from = Math.round(box.x + box.width * 0.85);
  const to = Math.round(box.x + box.width * 0.1);
  const point = (x) => [{ x, y, id: 1, radiusX: 1, radiusY: 1, force: 1 }];

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) });
  const steps = 12;
  for (let s = 1; s <= steps; s++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(Math.round(from + ((to - from) * s) / steps)),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expectOnPage(page, 1);
  await expect(label(page)).toHaveText('01 · Tonspur');
});

test.describe('at 375 px width', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  for (const [name, hash] of [['home', ''], ['Tonspur', '#tonspur']]) {
    test(`${name}: no horizontal overflow, the body does not scroll`, async ({ page }) => {
      await page.goto(`./${hash}`);
      if (hash) await expect(page.getByTestId('tonspur-action')).toBeVisible();
      else await expect(page.getByRole('heading', { name: 'Werkzeuge' })).toBeVisible();

      const m = await page.evaluate(() => {
        const s = document.scrollingElement;
        const before = [s.scrollLeft, s.scrollTop];
        window.scrollTo(200, 200);
        const after = [s.scrollLeft, s.scrollTop];
        const deck = document.querySelector('main.deck');
        const pages = [...deck.children].map((p) => ({ scroll: p.scrollWidth, client: p.clientWidth }));
        return {
          scrollWidth: s.scrollWidth,
          clientWidth: s.clientWidth,
          scrollHeight: s.scrollHeight,
          clientHeight: s.clientHeight,
          before,
          after,
          deckWidth: deck.clientWidth,
          pages,
        };
      });
      expect(m.clientWidth).toBe(375);
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      expect(m.scrollHeight).toBeLessThanOrEqual(m.clientHeight);
      expect(m.after).toEqual([0, 0]);
      expect(m.deckWidth).toBe(375);
      // No page is wider than the screen inside the deck either.
      for (const p of m.pages) expect(p.scroll).toBeLessThanOrEqual(p.client);
    });
  }
});

test('a tool mounts on first visit and stays mounted after swiping back', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Werkzeuge' })).toBeVisible();
  await expect(page.getByTestId('tonspur-action')).toHaveCount(0);
  await expect(tonspurPage(page)).toBeEmpty();

  await scrollDeckTo(page, 1);
  await expect(page.getByTestId('tonspur-action')).toBeVisible();

  await scrollDeckTo(page, 0);
  await expect(label(page)).toHaveText('00 · Übersicht');
  await expect(page.getByTestId('tonspur-action')).toHaveCount(1);
  await expect(tonspurPage(page)).toHaveAttribute('inert');
});

test('changing only the hash moves the deck', async ({ page }) => {
  await page.goto('./');
  await expectOnPage(page, 0);
  await page.evaluate(() => { location.hash = '#tonspur'; });
  await expectOnPage(page, 1);
  await expect(label(page)).toHaveText('01 · Tonspur');
});

test('home stays current and usable after load (no stray page switch)', async ({ page }) => {
  await page.goto('./');
  await expect(label(page)).toHaveText('00 · Übersicht');
  await expect(page.locator('section.page[data-index="0"]')).not.toHaveAttribute('inert', /.*/);
  await expect(page.getByTestId('tonspur-action')).toHaveCount(0);
  expect(await page.evaluate(() => location.hash)).toBe('');
});

test('a tool whose code fails to load can be retried', async ({ page }) => {
  let failed = 0;
  await page.route(/\/assets\/Tonspur-[^/]+\.js$/, (route) => {
    if (failed++ === 0) return route.abort();
    return route.continue();
  });
  await page.goto('./');
  await page.getByRole('button', { name: /Tonspur/ }).first().tap();
  await expect(tonspurPage(page)).toContainText('konnte nicht geladen werden');

  // Reloads on the tool's page (the hash is kept) and loads it this time.
  await tonspurPage(page).getByRole('button', { name: 'Neu laden' }).tap();
  await expect(page.getByTestId('tonspur-action')).toBeVisible();
  expect(failed).toBe(2);
});
