import puppeteer from 'puppeteer';
import { expect, test, vi } from 'vitest';
import type { LogEvent } from '../../src/index.js';
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

test('Browserの設定をPage・Keyboard・Locatorとチェーンへ引き継ぐ', async () => {
  const events: LogEvent[] = [];
  const raw = await puppeteer.launch({ headless: true });
  try {
    const browser = withBrowserLogging(raw, {
      adapter: {
        emit: (event) => {
          events.push(event);
        },
      },
      category: 'browser',
      levels: { start: 'debug', success: 'debug' },
    });
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.setContent('<input id="field"><button>Go</button>');
    await page.focus('#field');
    await page.keyboard.type('dummy-secret');
    await page.keyboard.press('Tab');
    await page.locator('input').setTimeout(1000).fill('dummy-replaced');
    await page.locator('button').setTimeout(1000).click();
    await expect(
      page.goto('invalid-protocol://dummy-secret'),
    ).rejects.toThrow();
    for (const operation of [
      'browser.newPage',
      'page.goto',
      'keyboard.type',
      'keyboard.press',
      'locator.fill',
      'locator.click',
    ]) {
      for (const phase of ['start', 'success'] as const) {
        expect(events).toContainEqual(
          expect.objectContaining({
            operation,
            phase,
            category: 'browser',
            level: 'debug',
          }),
        );
      }
    }
    expect(events).toHaveLength(14);
    expect(events.at(-1)).toMatchObject({
      operation: 'page.goto',
      phase: 'failure',
      category: 'browser',
      level: 'error',
    });
    expect(JSON.stringify(events)).not.toContain('dummy-');
  } finally {
    await raw.close();
  }
}, 20_000);
