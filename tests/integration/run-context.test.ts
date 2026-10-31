import puppeteer from 'puppeteer';
import { expect, test } from 'vitest';
import {
  withBrowserLogging,
  withPageLogging,
  withLocatorLogging,
  withRunContext,
} from '../../src/index.js';
import type { LogEvent } from '../../src/index.js';

test('キャッシュ済みBrowser・Page・Keyboard・Locatorとチェーンは実行時のrunIdを使う', async () => {
  const events: LogEvent[] = [];
  const raw = await puppeteer.launch({ headless: true });
  try {
    const options = {
      adapter: {
        emit: (event: LogEvent) => {
          events.push(event);
        },
      },
      category: 'browser',
      levels: { start: 'debug', success: 'debug' },
    } as const;
    const browser = withRunContext({ runId: 'creation' }, () =>
      withBrowserLogging(raw, options),
    );
    // Browserのメソッドキャッシュも文脈外で準備する。
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Proxyが実体へbind済みのメソッドをキャッシュすることを検証する。
    const newPage = browser.newPage;
    const page = await newPage();
    await page.setContent('<input><button>Go</button>');
    const keyboard = page.keyboard;
    const input = page.locator('input');
    const button = page.locator('button');
    const chained = input.setTimeout(1000);
    // 子メソッドの初回取得が文脈内でもIDを固定しない。
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Proxyが実体へbind済みのメソッドをキャッシュすることを検証する。
    const type = withRunContext({ runId: 'lookup' }, () => keyboard.type);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Proxyが実体へbind済みのメソッドをキャッシュすることを検証する。
    const goto = page.goto;
    expect(withBrowserLogging(raw, { category: 'ignored' })).toBe(browser);
    expect(withPageLogging(page, { category: 'ignored' })).toBe(page);
    expect(page.keyboard).toBe(keyboard);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Proxyが実体へbind済みのメソッドをキャッシュすることを検証する。
    expect(keyboard.type).toBe(type);
    expect(withLocatorLogging(chained)).toBe(chained);
    events.length = 0;
    for (const runId of ['run-A', 'run-B']) {
      await withRunContext({ runId }, async () => {
        const extra = await newPage();
        await extra.close();
        await goto('about:blank');
        await page.setContent('<input><button>Go</button>');
        await page.focus('input');
        await type('dummy-secret');
        await keyboard.press('Tab');
        await chained.fill('dummy-replaced');
        await button.setTimeout(1000).click();
        await expect(goto('invalid-protocol://dummy-secret')).rejects.toThrow();
      });
      const runEvents = events.filter((event) => event.runId === runId);
      expect(runEvents).toHaveLength(14);
      for (const operation of [
        'browser.newPage',
        'page.goto',
        'keyboard.type',
        'keyboard.press',
        'locator.fill',
        'locator.click',
      ]) {
        expect(runEvents).toContainEqual(
          expect.objectContaining({
            operation,
            phase: 'start',
            category: 'browser',
            level: 'debug',
          }),
        );
        expect(runEvents).toContainEqual(
          expect.objectContaining({
            operation,
            phase: 'success',
            category: 'browser',
            level: 'debug',
          }),
        );
      }
      expect(runEvents.at(-1)).toMatchObject({
        operation: 'page.goto',
        phase: 'failure',
        category: 'browser',
        level: 'error',
      });
    }
    expect(events).toHaveLength(28);
    expect(JSON.stringify(events)).not.toContain('dummy-');
    await goto('about:blank');
    expect(events.at(-1)).not.toHaveProperty('runId');
  } finally {
    await raw.close();
  }
}, 20_000);
