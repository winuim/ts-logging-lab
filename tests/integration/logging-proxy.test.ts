import puppeteer from 'puppeteer';
import { expect, test, vi } from 'vitest';
import { withBrowserLogging } from '../../src/index.js';
import { logRecords } from '../helpers/log-records.js';

test('BrowserからPage・Keyboard・Locatorへ渡り、チェーン後もログ化する', async () => {
  const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const raw = await puppeteer.launch({ headless: true });
  try {
    const browser = withBrowserLogging(raw);
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.setContent('<input id="field"><button id="button">Go</button>');
    await page.focus('#field');
    await page.keyboard.type('dummy');
    await page.locator('input').setTimeout(1000).fill('replaced');
    await page.locator('button').setTimeout(1000).click();
    expect(await page.$eval('input', (input) => input.value)).toBe('replaced');

    const events = logRecords(output.mock.calls);
    for (const operation of [
      'browser.newPage',
      'page.goto',
      'keyboard.type',
      'locator.fill',
      'locator.click',
    ]) {
      for (const phase of ['start', 'success'] as const) {
        expect(events).toContainEqual(
          expect.objectContaining({ operation, phase }),
        );
      }
    }
    expect(JSON.stringify(events)).not.toContain('replaced');
  } finally {
    await raw.close();
    output.mockRestore();
  }
}, 20_000);
