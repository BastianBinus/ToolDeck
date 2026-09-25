import { test, expect } from '@playwright/test';

// The only spec that lets service workers run (playwright.config blocks them).
test.use({ serviceWorkers: 'allow' });

// Width and height from a PNG's IHDR chunk.
function pngSize(buf) {
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

async function manifestOf(page) {
  const link = page.locator('link[rel="manifest"]');
  await expect(link).toHaveCount(1);
  const href = await link.evaluate((el) => el.href);
  const res = await page.request.get(href);
  expect(res.status(), href).toBe(200);
  return { href, manifest: await res.json() };
}

test('the page links a manifest for an installable standalone app', async ({ page }) => {
  await page.goto('./');
  const { manifest } = await manifestOf(page);

  expect(manifest.name).toBe('ToolDeck');
  expect(manifest.display).toBe('standalone');
  // start_url and scope point into the app's base path.
  expect(new URL(manifest.start_url, page.url()).pathname).toBe('/ToolDeck/');
  expect(new URL(manifest.scope, page.url()).pathname).toBe('/ToolDeck/');
});

test('the manifest icons 192 and 512 are reachable PNGs of that size', async ({ page }) => {
  await page.goto('./');
  const { href, manifest } = await manifestOf(page);

  for (const size of [192, 512]) {
    const icon = manifest.icons.find((i) => i.sizes.split(/\s+/).includes(`${size}x${size}`));
    expect(icon, `icon ${size}x${size} in manifest`).toBeTruthy();
    const url = new URL(icon.src, href).href;
    const res = await page.request.get(url);
    expect(res.status(), url).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    expect(pngSize(await res.body())).toEqual([size, size]);
  }
});

test('the apple-touch-icon is reachable', async ({ page }) => {
  await page.goto('./');
  const link = page.locator('link[rel="apple-touch-icon"]');
  await expect(link).toHaveCount(1);
  const url = await link.evaluate((el) => el.href);
  expect(new URL(url).pathname.startsWith('/ToolDeck/')).toBe(true);
  const res = await page.request.get(url);
  expect(res.status(), url).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
  const [w, h] = pngSize(await res.body());
  expect(w).toBe(h);
  expect(w).toBeGreaterThanOrEqual(180);
});

test('a service worker takes over the app', async ({ page }) => {
  await page.goto('./');
  const scope = await page.evaluate(() =>
    Promise.race([
      navigator.serviceWorker.ready.then((r) => r.scope),
      new Promise((_, reject) => setTimeout(() => reject(new Error('serviceWorker.ready timed out')), 10_000)),
    ]),
  );
  expect(new URL(scope).pathname).toBe('/ToolDeck/');
});
