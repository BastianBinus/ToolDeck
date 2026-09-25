import { test, expect } from '@playwright/test';
import {
  SR,
  LOUD_65,
  WITH_SILENCE,
  GARBAGE,
  installFakeWorker,
  fakeWorkers,
  scrollDeckTo,
  currentLabel,
  openTonspur,
  action,
  status,
  fileInput,
} from './helpers.js';

// The real worker loads transformers.js from a CDN and Whisper from Hugging Face,
// neither of which tests can reach. Every test here swaps window.Worker for the
// fake in helpers.js and checks the page's side of the protocol.

const chip = (page, name) => page.getByTestId(`chip-${name}`);
const notice = (page) => page.getByTestId('notice');
const segments = (page) => page.getByTestId('segments').locator('.segment');
const copyButton = (page) => page.getByTestId('copy');
const transcriptHeading = (page) => page.locator('section.transcript h3');
const setMode = (page, mode) => page.evaluate((m) => (window.__fakeMode = m), mode);
const workerCount = (page) => page.evaluate(() => window.__fakeWorkers.length);

// Takes the file and presses "Transkribieren".
async function choose(page, file) {
  await fileInput(page).setInputFiles(file);
  await expect(action(page)).toHaveText('Transkribieren');
}

async function run(page, file) {
  await choose(page, file);
  await action(page).click();
}

async function runToEnd(page, file = LOUD_65()) {
  await run(page, file);
  await expect(status(page)).toHaveText(/^Fertig in/);
  await expect(action(page)).toHaveText('Nochmal');
}

test.describe('with the fake worker', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeWorker(page, 'ok');
  });

  test('starts idle, with the example transcript and no worker', async ({ page }) => {
    await openTonspur(page);
    await expect(action(page)).toHaveText('Video wählen');
    await expect(status(page)).toHaveText('Bereit');
    await expect(notice(page)).toBeHidden();
    await expect(transcriptHeading(page)).toContainText('Beispiel');
    await expect(segments(page)).not.toHaveCount(0);
    await expect(copyButton(page)).toBeHidden();
    await expect(fileInput(page)).toHaveCount(1);
    // Hidden from view: display:none / hidden, or visually hidden (the stage card
    // is its label). Playwright counts opacity 0 as visible, so check by hand.
    const shown = await fileInput(page).evaluate((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && r.width > 1 && r.height > 1;
    });
    expect(shown).toBe(false);
    // The model is only loaded when a run starts.
    expect(await workerCount(page)).toBe(0);
  });

  test('"Video wählen" opens the file picker; picking a file makes it "Transkribieren"', async ({ page }) => {
    await openTonspur(page);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), action(page).click()]);
    expect(chooser.isMultiple()).toBe(false);
    await chooser.setFiles(LOUD_65());
    await expect(action(page)).toHaveText('Transkribieren');
    await expect(status(page)).toHaveText('Bereit');
    await expect(page.locator('.stage .meta')).toContainText('interview.wav');
    expect(await workerCount(page)).toBe(0);
  });

  test('happy path: three parts, fake texts, finished', async ({ page }) => {
    await openTonspur(page);
    await runToEnd(page);

    const workers = await fakeWorkers(page);
    expect(workers).toHaveLength(1);
    const [w] = workers;
    expect(w.options).toEqual({ type: 'module' });
    expect(w.url).toMatch(/worker[^/]*\.js/);
    expect(w.terminated).toBe(false);

    const runs = w.messages.filter((m) => m.type === 'run');
    expect(runs).toHaveLength(1);
    const msg = runs[0];
    expect(msg.model).toBe('base');
    expect(msg.language).toBe('auto');
    expect(msg.device).toBe('wasm');
    expect(msg.audioType).toBe('Float32Array');
    expect(msg.audioLength).toBe(65 * SR);
    // The audio buffer is transferred, not copied.
    expect(msg.transferred).toBe(1);
    expect(msg.detachedInPage).toBe(true);

    expect(msg.chunks).toHaveLength(3);
    expect(msg.chunks[0].start).toBe(0);
    expect(msg.chunks.at(-1).end).toBe(65 * SR);
    for (let i = 1; i < 3; i++) expect(msg.chunks[i].start).toBe(msg.chunks[i - 1].end);
    expect(msg.chunks.every((c) => c.silent === false)).toBe(true);

    const rows = segments(page);
    await expect(rows).toHaveCount(3);
    await expect(rows.locator('p')).toHaveText(['Teil 1 gesprochen.', 'Teil 2 gesprochen.', 'Teil 3 gesprochen.']);
    const tc = (s) =>
      [Math.floor(s / 3600), Math.floor(s / 60) % 60, Math.floor(s) % 60].map((n) => String(n).padStart(2, '0')).join(':');
    await expect(rows.locator('.tc')).toHaveText([
      '00:00:00 · DE',
      `${tc(msg.chunks[1].start / SR)} · EN`,
      `${tc(msg.chunks[2].start / SR)} · DE`,
    ]);
    await expect(page.locator('.segment.quiet')).toHaveCount(0);

    await expect(transcriptHeading(page)).not.toContainText('Beispiel');
    await expect(transcriptHeading(page)).toContainText('3/3');
    await expect(copyButton(page)).toBeVisible();
    await expect(copyButton(page)).toHaveText('Text kopieren');
    await expect(notice(page)).toBeHidden();
    await expect(chip(page, 'model')).toBeEnabled();
  });

  test('reports each part while it listens', async ({ page }) => {
    await openTonspur(page);
    await setMode(page, 'slow');
    await run(page, LOUD_65());
    // Slow mode answers part 1, then waits.
    await expect(status(page)).toHaveText('Höre zu · Teil 2 von 3');
    await expect(segments(page)).toHaveCount(1);
    await expect(transcriptHeading(page)).toContainText('1/3');
  });

  test('a silent part shows "Keine Sprache"', async ({ page }) => {
    await openTonspur(page);
    await runToEnd(page, WITH_SILENCE());

    const [w] = await fakeWorkers(page);
    const { chunks } = w.messages.find((m) => m.type === 'run');
    expect(chunks.map((c) => c.silent)).toEqual([false, true]);

    const rows = segments(page);
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).not.toHaveClass(/\bquiet\b/);
    await expect(rows.nth(0).locator('p')).toHaveText('Teil 1 gesprochen.');
    await expect(rows.nth(1)).toHaveClass(/\bquiet\b/);
    await expect(rows.nth(1).locator('p')).toHaveText('Keine Sprache');
    // No language on a silent part.
    await expect(rows.nth(1).locator('.tc')).toHaveText(/^\d\d:\d\d:\d\d$/);
  });

  test('Stopp cancels the run', async ({ page }) => {
    await openTonspur(page);
    await setMode(page, 'slow');
    await run(page, LOUD_65());

    await expect(action(page)).toHaveText('Stopp');
    await expect(status(page)).toHaveText('Höre zu · Teil 2 von 3');
    // Settings and file are locked while it runs.
    await expect(chip(page, 'model')).toBeDisabled();
    await expect(chip(page, 'lang')).toBeDisabled();
    await expect(chip(page, 'gpu')).toBeDisabled();
    await expect(fileInput(page)).toBeDisabled();

    await action(page).click();
    await expect(status(page)).toHaveText('Gestoppt');
    await expect(action(page)).toHaveText('Nochmal');

    const [w] = await fakeWorkers(page);
    expect(w.messages.map((m) => m.type)).toEqual(['run', 'cancel']);
    await expect(segments(page)).toHaveCount(1);
    await expect(chip(page, 'model')).toBeEnabled();
  });

  test('a worker error shows the notice and drops the worker', async ({ page }) => {
    await openTonspur(page);
    await setMode(page, 'error');
    await run(page, LOUD_65());

    await expect(status(page)).toHaveText('Etwas ist schiefgelaufen');
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText('Failed to fetch');
    await expect(action(page)).toHaveText('Nochmal');
    await expect.poll(async () => (await fakeWorkers(page))[0].terminated).toBe(true);

    // The next run starts a fresh worker and clears the notice.
    await setMode(page, 'ok');
    await action(page).click();
    await expect(status(page)).toHaveText(/^Fertig in/);
    await expect(notice(page)).toBeHidden();
    const workers = await fakeWorkers(page);
    expect(workers).toHaveLength(2);
    expect(workers[1].terminated).toBe(false);
    expect(workers[1].messages.map((m) => m.type)).toEqual(['run']);
  });

  test('a file without readable audio fails before any worker starts', async ({ page }) => {
    await openTonspur(page);
    await run(page, GARBAGE());

    await expect(status(page)).toHaveText('Ton konnte nicht gelesen werden');
    await expect(notice(page)).toBeVisible();
    await expect(action(page)).toHaveText('Transkribieren');
    expect(await workerCount(page)).toBe(0);
  });

  test('chips cycle and are remembered across a reload', async ({ page }) => {
    await openTonspur(page);
    const model = chip(page, 'model');
    const lang = chip(page, 'lang');

    await expect(model).toContainText('Base');
    await expect(lang).toHaveText('DE + EN');
    await expect(chip(page, 'gpu')).toHaveText('CPU');

    for (const name of ['Small', 'Tiny', 'Base', 'Small']) {
      await model.click();
      await expect(model).toContainText(name);
    }
    expect(await page.evaluate(() => localStorage.getItem('tonspur.model'))).toBe('small');

    for (const name of ['Deutsch', 'Englisch', 'DE + EN', 'Deutsch', 'Englisch']) {
      await lang.click();
      await expect(lang).toHaveText(name);
    }
    expect(await page.evaluate(() => localStorage.getItem('tonspur.lang'))).toBe('en');

    await page.reload();
    await expect(action(page)).toBeVisible();
    await expect(model).toContainText('Small');
    await expect(lang).toHaveText('Englisch');

    // The remembered settings go into the run.
    await runToEnd(page);
    const [w] = await fakeWorkers(page);
    const msg = w.messages.find((m) => m.type === 'run');
    expect(msg.model).toBe('small');
    expect(msg.language).toBe('en');
    expect(msg.device).toBe('wasm');
  });

  test('without navigator.gpu the GPU chip is disabled and shows CPU', async ({ page }) => {
    await page.addInitScript(() => {
      delete Navigator.prototype.gpu;
      delete navigator.gpu;
      // A stale setting from a device that had WebGPU must not switch it on.
      localStorage.setItem('tonspur.gpu', '1');
    });
    await openTonspur(page);
    expect(await page.evaluate(() => 'gpu' in navigator)).toBe(false);
    await expect(chip(page, 'gpu')).toHaveText('CPU');
    await expect(chip(page, 'gpu')).toBeDisabled();

    await runToEnd(page);
    const [w] = await fakeWorkers(page);
    expect(w.messages.find((m) => m.type === 'run').device).toBe('wasm');
  });

  test('with navigator.gpu the GPU chip toggles, is remembered and picks webgpu', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'gpu', {
        configurable: true,
        get: () => ({ requestAdapter: async () => null }),
      });
    });
    await openTonspur(page);
    const gpu = chip(page, 'gpu');
    await expect(gpu).toBeEnabled();
    await expect(gpu).toHaveText('CPU');

    await gpu.click();
    await expect(gpu).toHaveText('GPU');
    expect(await page.evaluate(() => localStorage.getItem('tonspur.gpu'))).toBe('1');
    await gpu.click();
    await expect(gpu).toHaveText('CPU');
    expect(await page.evaluate(() => localStorage.getItem('tonspur.gpu'))).toBe('0');
    await gpu.click();

    await page.reload();
    await expect(gpu).toHaveText('GPU');

    await runToEnd(page);
    const [w] = await fakeWorkers(page);
    expect(w.messages.find((m) => m.type === 'run').device).toBe('webgpu');
  });

  test('"Text kopieren" copies the transcript', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL).origin });
    await openTonspur(page);
    await runToEnd(page);

    await copyButton(page).click();
    await expect(copyButton(page)).toHaveText('Kopiert ✓');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'Teil 1 gesprochen. Teil 2 gesprochen. Teil 3 gesprochen.',
    );
    // The label goes back after a moment.
    await expect(copyButton(page)).toHaveText('Text kopieren');
  });

  test('silent parts are left out of the copied text', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL).origin });
    await openTonspur(page);
    await runToEnd(page, WITH_SILENCE());

    await copyButton(page).click();
    await expect(copyButton(page)).toHaveText('Kopiert ✓');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Teil 1 gesprochen.');
  });

  test('memory: leaving Tonspur after a run frees the worker; the next run makes a new one', async ({ page }) => {
    await openTonspur(page);
    await runToEnd(page);
    expect((await fakeWorkers(page))[0].terminated).toBe(false);

    await scrollDeckTo(page, 0);
    await expect.poll(() => currentLabel(page)).toBe('00 · Übersicht');
    await expect.poll(async () => (await fakeWorkers(page))[0].terminated).toBe(true);

    await scrollDeckTo(page, 1);
    await expect.poll(() => currentLabel(page)).toBe('01 · Tonspur');
    // The transcript is still there after swiping back.
    await expect(segments(page)).toHaveCount(3);
    await action(page).click();
    await expect(status(page)).toHaveText(/^Fertig in/);

    const workers = await fakeWorkers(page);
    expect(workers).toHaveLength(2);
    expect(workers[0].terminated).toBe(true);
    expect(workers[1].terminated).toBe(false);
    expect(workers[1].messages.map((m) => m.type)).toEqual(['run']);
    // The first worker got nothing after it was let go.
    expect(workers[0].messages.map((m) => m.type)).toEqual(['run']);
  });

  test('memory: leaving Tonspur during a run keeps the worker going', async ({ page }) => {
    await openTonspur(page);
    await setMode(page, 'slow');
    await run(page, LOUD_65());
    await expect(status(page)).toHaveText('Höre zu · Teil 2 von 3');

    await scrollDeckTo(page, 0);
    await expect.poll(() => currentLabel(page)).toBe('00 · Übersicht');
    // Give an eager cleanup the chance to (wrongly) fire.
    await page.waitForTimeout(300);
    expect((await fakeWorkers(page))[0].terminated).toBe(false);

    await scrollDeckTo(page, 1);
    await expect.poll(() => currentLabel(page)).toBe('01 · Tonspur');
    await expect(action(page)).toHaveText('Stopp');
    await action(page).click();
    await expect(status(page)).toHaveText('Gestoppt');
  });
});
