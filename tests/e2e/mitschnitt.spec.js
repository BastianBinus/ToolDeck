import { test, expect } from '@playwright/test';

const ID = 'dQw4w9WgXcQ';
const action = (page) => page.getByTestId('mitschnitt-action');
const input = (page) => page.getByLabel('YouTube link');

async function open(page) {
  await page.goto('./#mitschnitt');
  await expect(action(page)).toBeVisible();
}

test('the button stays off until a YouTube link is entered', async ({ page }) => {
  await open(page);
  await expect(action(page)).toBeDisabled();
  await expect(page.getByTestId('mitschnitt-meta')).toHaveText('Paste a link');

  await input(page).fill('https://example.com/x');
  await expect(action(page)).toBeDisabled();
  await expect(page.getByTestId('mitschnitt-meta')).toHaveText('Not a YouTube link');
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

test('the quality segments change the link and are remembered', async ({ page }) => {
  await open(page);
  await input(page).fill(ID);
  const quality = page.getByTestId('mitschnitt-quality');
  const segment = (label) => quality.getByRole('radio', { name: label });
  await expect(quality.getByRole('radio', { checked: true })).toHaveText('720p');

  await segment('At most 1080p').tap();
  await expect(segment('At most 1080p')).toHaveAttribute('aria-checked', 'true');
  await expect(segment('At most 720p')).toHaveAttribute('aria-checked', 'false');
  await expect(action(page)).toHaveAttribute('href', /%23h%3D1080$/);

  await segment('Best, no limit').tap();
  const text = new URL(await action(page).getAttribute('href')).searchParams.get('text');
  expect(text).toBe(`https://www.youtube.com/watch?v=${ID}`);

  await page.reload();
  await expect(page.getByTestId('mitschnitt-quality').getByRole('radio', { checked: true })).toHaveText('Best');
  await page.getByTestId('mitschnitt-quality').getByRole('radio', { name: 'At most 360p' }).tap();
  await input(page).fill(ID);
  await expect(action(page)).toHaveAttribute('href', /%23h%3D360$/);
});

test('tapping Download shows where it went', async ({ page }) => {
  await open(page);
  await input(page).fill(ID);
  // The shortcuts: link has nowhere to go in a test browser; only the toast matters.
  await action(page).evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
  await action(page).tap();
  await expect(page.locator('.mitschnitt').getByRole('status')).toHaveText('Opening Shortcuts → ToolDeck YT · 720p');
});

test('the setup points at the script, which is served next to the app', async ({ page, request }) => {
  await open(page);
  const toggle = page.getByRole('button', { name: /One-time setup/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const cmd = page.locator('.setup code', { hasText: 'curl -fLO' });
  const scriptUrl = (await cmd.textContent()).match(/curl -fLO (\S+)/)[1];
  expect(scriptUrl).toMatch(/\/ToolDeck\/mitschnitt\/ytmp4\.py$/);

  // a-Shell garbles pasted lines that wrap over several terminal rows (holzschu/a-shell#1057).
  for (const text of await page.locator('.setup code').allTextContents()) {
    expect(text).not.toContain('\n');
    expect(text.length).toBeLessThanOrEqual(80);
  }

  const res = await request.get(scriptUrl);
  expect(res.ok()).toBe(true);
  expect(await res.text()).toContain('from yt_dlp import YoutubeDL');

  // Closing it once keeps it closed.
  await toggle.tap();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(cmd).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: /One-time setup/ })).toHaveAttribute('aria-expanded', 'false');
});

test.describe('at 375 px width', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('no horizontal overflow', async ({ page }) => {
    await open(page);
    await input(page).fill(`https://www.youtube.com/watch?v=${ID}&list=PL${'x'.repeat(60)}`);
    const m = await page.evaluate(() => {
      const p = document.querySelector('.page[data-tool="mitschnitt"]');
      return { scroll: p.scrollWidth, client: p.clientWidth, body: document.scrollingElement.scrollWidth };
    });
    expect(m.scroll).toBeLessThanOrEqual(m.client);
    expect(m.body).toBeLessThanOrEqual(375);
  });
});
