import { test, expect } from '@playwright/test';

const ID = 'dQw4w9WgXcQ';
const action = (page) => page.getByTestId('mitschnitt-action');
const input = (page) => page.getByLabel('YouTube-Link');

async function open(page) {
  await page.goto('./#mitschnitt');
  await expect(action(page)).toBeVisible();
}

test('the button stays off until a YouTube link is entered', async ({ page }) => {
  await open(page);
  await expect(action(page)).toBeDisabled();
  await expect(page.getByTestId('mitschnitt-meta')).toHaveText('Link einfügen');

  await input(page).fill('https://example.com/x');
  await expect(action(page)).toBeDisabled();
  await expect(page.getByTestId('mitschnitt-meta')).toHaveText('Kein YouTube-Link');
  await expect(input(page)).toHaveAttribute('aria-invalid', 'true');

  await input(page).fill(`https://youtu.be/${ID}?si=tracking`);
  await expect(page.getByTestId('mitschnitt-meta')).toHaveText(`ID ${ID}`);
  const href = await action(page).getAttribute('href');
  const url = new URL(href);
  expect(url.protocol).toBe('shortcuts:');
  expect(url.searchParams.get('name')).toBe('ToolDeck YT');
  // The tracking parameter is gone, the default limit is 720p.
  expect(url.searchParams.get('text')).toBe(`https://www.youtube.com/watch?v=${ID}#h=720`);
});

test('the quality chip cycles, changes the link and is remembered', async ({ page }) => {
  await open(page);
  await input(page).fill(ID);
  const chip = page.getByTestId('mitschnitt-quality');
  await expect(chip).toContainText('720p');

  await chip.tap();
  await expect(chip).toContainText('1080p');
  await expect(action(page)).toHaveAttribute('href', /%23h%3D1080$/);

  await chip.tap();
  await expect(chip).toContainText('Beste');
  const text = new URL(await action(page).getAttribute('href')).searchParams.get('text');
  expect(text).toBe(`https://www.youtube.com/watch?v=${ID}`);

  await page.reload();
  await expect(page.getByTestId('mitschnitt-quality')).toContainText('Beste');
  await page.getByTestId('mitschnitt-quality').tap();
  await expect(page.getByTestId('mitschnitt-quality')).toContainText('360p');
});

test('the setup points at the script, which is served next to the app', async ({ page, request }) => {
  await open(page);
  const setup = page.locator('details.setup');
  await expect(setup).toHaveAttribute('open', '');
  const cmd = setup.locator('code', { hasText: 'curl -L' });
  const scriptUrl = (await cmd.textContent()).match(/curl -L (\S+)/)[1];
  expect(scriptUrl).toMatch(/\/ToolDeck\/mitschnitt\/ytmp4\.py$/);

  const res = await request.get(scriptUrl);
  expect(res.ok()).toBe(true);
  expect(await res.text()).toContain('from yt_dlp import YoutubeDL');

  // Closing it once keeps it closed.
  await setup.locator('summary').tap();
  await expect(setup).not.toHaveAttribute('open');
  await page.reload();
  await expect(page.locator('details.setup')).not.toHaveAttribute('open');
});

test.describe('at 375 px width', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('no horizontal overflow', async ({ page }) => {
    await open(page);
    await input(page).fill(`https://www.youtube.com/watch?v=${ID}&list=PL${'x'.repeat(60)}`);
    const m = await page.evaluate(() => {
      const p = document.querySelector('section.page[aria-label="Mitschnitt"]');
      return { scroll: p.scrollWidth, client: p.clientWidth, body: document.scrollingElement.scrollWidth };
    });
    expect(m.scroll).toBeLessThanOrEqual(m.client);
    expect(m.body).toBeLessThanOrEqual(375);
  });
});
