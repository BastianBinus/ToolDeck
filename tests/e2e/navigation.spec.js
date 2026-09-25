import { test, expect } from '@playwright/test';
import { tools } from '../../src/tools/index.js';
import { installFakeWorker, toolPage, expectOpen, expectHome, openFromHome, goHome } from './helpers.js';

const pad = (n) => String(n).padStart(2, '0');
const count = (i) => `${pad(i + 1)} / ${pad(tools.length)}`;
const rows = (page) => page.locator('.drum .row');
const dialName = (page) => page.locator('.dial h2');
const pickerButton = (page, name) => page.getByRole('group', { name: 'Picker' }).getByRole('button', { name });

// Turns the dial by dragging a mouse pointer around its centre, `degrees`
// clockwise, starting at the left edge of the disc.
async function dragDial(page, degrees) {
  const box = await page.getByTestId('dial').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = box.width * 0.4;
  // θ = 0 at the top, clockwise; the drag starts at the left edge (θ = -90°).
  const at = (deg) => {
    const t = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.sin(t), cy - r * Math.cos(t)];
  };
  await page.mouse.move(...at(0));
  await page.mouse.down();
  const steps = 24;
  for (let s = 1; s <= steps; s++) await page.mouse.move(...at((degrees * s) / steps));
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  // Keeps Tonspur from starting the real worker if a test happens to reach it.
  await installFakeWorker(page);
});

test('home shows the drum with every tool and loads without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => msg.type() === 'error' && errors.push(`console: ${msg.text()}`));

  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'ToolDeck' })).toBeVisible();
  await expect(pickerButton(page, 'Drum')).toHaveAttribute('aria-pressed', 'true');

  await expect(rows(page)).toHaveCount(tools.length);
  for (const [i, tool] of tools.entries()) {
    await expect(rows(page).nth(i)).toContainText(tool.name);
    await expect(rows(page).nth(i)).toContainText(pad(i + 1));
  }
  await expect(rows(page).first()).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.drum .meta')).toContainText(count(0));
  await expect(page.locator('.drum .blurb')).toHaveText(tools[0].blurb);
  await expect(page.getByRole('button', { name: `Open ${tools[0].name}` })).toBeVisible();

  await expectHome(page);
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('tapping a drum row selects it, tapping it again opens the tool', async ({ page }) => {
  await page.goto('./');
  const row = rows(page).filter({ hasText: 'Mitschnitt' });
  await row.click();
  await expect(row).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.drum .blurb')).toHaveText('YouTube → MP4');
  await expect(page.locator('.drum .meta')).toContainText(count(1));
  await expectHome(page);

  await row.click();
  await expectOpen(page, 'mitschnitt');
  await expect(page.locator('.layer .count')).toHaveText(count(1));
  await expect(page.locator('section.home')).toHaveAttribute('inert');
});

test('scrolling the drum moves the selection', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('drum').evaluate((el) => el.scrollTo({ top: 52, behavior: 'instant' }));
  await expect(rows(page).nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('button', { name: `Open ${tools[1].name}` })).toBeVisible();

  await page.getByTestId('drum').evaluate((el) => el.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(rows(page).nth(0)).toHaveAttribute('aria-current', 'true');
});

test('the Open button opens the selected tool and sets the hash', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open Tonspur' }).click();
  await expectOpen(page, 'tonspur');
  await expect(toolPage(page, 'tonspur').getByRole('heading', { level: 1 })).toHaveText('Tonspur');
  await expect(page.getByTestId('tonspur-action')).toBeVisible();
});

test('deep link #tonspur opens directly on the Tonspur page', async ({ page }) => {
  await page.goto('./#tonspur');
  await expectOpen(page, 'tonspur');
  await expect(page.locator('.layer .count')).toHaveText(count(0));
  await expect(page.getByTestId('tonspur-action')).toBeVisible();
});

test('the Tools button returns home and clears the hash', async ({ page }) => {
  await page.goto('./#mitschnitt');
  await expectOpen(page, 'mitschnitt');

  await goHome(page);
  expect(new URL(page.url()).pathname).toBe('/ToolDeck/');
  // The picker comes back on the tool that was open.
  await expect(rows(page).filter({ hasText: 'Mitschnitt' })).toHaveAttribute('aria-current', 'true');
});

test('browser back and forward move between home and the tool', async ({ page }) => {
  await page.goto('./');
  await openFromHome(page, 'Mitschnitt');
  await expectOpen(page, 'mitschnitt');

  await page.goBack();
  await expectHome(page);

  await page.goForward();
  await expectOpen(page, 'mitschnitt');

  // Back via the Tools button pops the entry instead of stacking another one.
  await goHome(page);
  await page.goForward();
  await expectOpen(page, 'mitschnitt');
});

test('changing only the hash opens the tool', async ({ page }) => {
  await page.goto('./');
  await expectHome(page);
  await page.evaluate(() => { location.hash = '#tonspur'; });
  await expectOpen(page, 'tonspur');
});

test('the picker toggle switches to the dial, keeps the selection and is remembered', async ({ page }) => {
  await page.goto('./');
  await rows(page).filter({ hasText: 'Mitschnitt' }).click();
  await expect(rows(page).nth(1)).toHaveAttribute('aria-current', 'true');

  await pickerButton(page, 'Dial').click();
  await expect(pickerButton(page, 'Dial')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialName(page)).toHaveText('Mitschnitt');
  await expect(page.locator('.dial .meta')).toContainText(count(1));
  expect(await page.evaluate(() => localStorage.getItem('tooldeck.picker'))).toBe('dial');

  await page.reload();
  await expect(dialName(page)).toBeVisible();
  await expect(rows(page)).toHaveCount(0);

  await pickerButton(page, 'Drum').click();
  await expect(rows(page)).toHaveCount(tools.length);
  expect(await page.evaluate(() => localStorage.getItem('tooldeck.picker'))).toBe('drum');
});

test('dial: tapping a tool selects it, tapping it again opens it', async ({ page }) => {
  await page.goto('./');
  await pickerButton(page, 'Dial').click();
  await expect(dialName(page)).toHaveText(tools[0].name);

  const item = page.getByTestId('dial').getByRole('button', { name: 'Mitschnitt', exact: true });
  await item.click();
  await expect(dialName(page)).toHaveText('Mitschnitt');
  await expect(item).toHaveAttribute('aria-current', 'true');

  // Let the snap animation settle before tapping the moving button again.
  await page.waitForTimeout(600);
  await item.click();
  await expectOpen(page, 'mitschnitt');
});

test('dial: the centre button opens the selected tool', async ({ page }) => {
  await page.goto('./');
  await pickerButton(page, 'Dial').click();
  await page.getByRole('button', { name: `Open ${tools[0].name}` }).click();
  await expectOpen(page, tools[0].id);
});

test('dial: dragging turns it and it snaps to a tool; a drag is not a tap', async ({ page }) => {
  await page.goto('./');
  await pickerButton(page, 'Dial').click();
  await expect(dialName(page)).toHaveText(tools[0].name);

  // Half a turn with two tools brings the other one under the marker.
  await dragDial(page, 180 + 20);
  await expect(dialName(page)).toHaveText(tools[1 % tools.length].name);
  await expectHome(page);

  // It settles on a whole step.
  await expect
    .poll(() =>
      page.locator('.rotor').evaluate((el) => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const deg = (Math.atan2(m.b, m.a) * 180) / Math.PI;
        const step = 360 / document.querySelectorAll('.dial .item').length;
        const off = ((deg % step) + step) % step;
        return Math.min(off, step - off) < 0.5;
      }),
    )
    .toBe(true);
});

test('a tool mounts on first open and stays mounted after going back', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('tonspur-action')).toHaveCount(0);
  await expect(toolPage(page, 'tonspur')).toHaveCount(0);

  await openFromHome(page, 'Tonspur');
  await expect(page.getByTestId('tonspur-action')).toBeVisible();

  await goHome(page);
  await expect(page.getByTestId('tonspur-action')).toHaveCount(1);
  await expect(toolPage(page, 'tonspur')).toHaveAttribute('inert');
});

test('a tool whose code fails to load can be retried', async ({ page }) => {
  let failed = 0;
  await page.route(/\/assets\/Tonspur-[^/]+\.js$/, (route) => {
    if (failed++ === 0) return route.abort();
    return route.continue();
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open Tonspur' }).tap();
  await expect(toolPage(page, 'tonspur')).toContainText('could not be loaded');

  // Reloads on the tool's page (the hash is kept) and loads it this time.
  await toolPage(page, 'tonspur').getByRole('button', { name: 'Reload' }).tap();
  await expect(page.getByTestId('tonspur-action')).toBeVisible();
  expect(failed).toBe(2);
});

test.describe('at 375 px width', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  for (const [name, setup] of [
    ['home (drum)', async (page) => { await page.goto('./'); await expect(rows(page).first()).toBeVisible(); }],
    ['home (dial)', async (page) => {
      await page.addInitScript(() => localStorage.setItem('tooldeck.picker', 'dial'));
      await page.goto('./');
      await expect(page.getByTestId('dial')).toBeVisible();
    }],
    ['Tonspur', async (page) => { await page.goto('./#tonspur'); await expect(page.getByTestId('tonspur-action')).toBeVisible(); }],
  ]) {
    test(`${name}: no horizontal overflow, the body does not scroll`, async ({ page }) => {
      await setup(page);
      // Let the page transition finish.
      await page.waitForTimeout(500);

      const m = await page.evaluate(() => {
        const s = document.scrollingElement;
        window.scrollTo(200, 200);
        const pages = [...document.querySelectorAll('.page, .home')].map((p) => ({ scroll: p.scrollWidth, client: p.clientWidth }));
        return {
          scrollWidth: s.scrollWidth,
          clientWidth: s.clientWidth,
          scrollHeight: s.scrollHeight,
          clientHeight: s.clientHeight,
          after: [s.scrollLeft, s.scrollTop],
          pages,
        };
      });
      expect(m.clientWidth).toBe(375);
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      expect(m.scrollHeight).toBeLessThanOrEqual(m.clientHeight);
      expect(m.after).toEqual([0, 0]);
      for (const p of m.pages) expect(p.scroll).toBeLessThanOrEqual(p.client);
    });
  }

  test('the dial fits the screen width', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tooldeck.picker', 'dial'));
    await page.goto('./');
    const box = await page.getByTestId('dial').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  });
});
