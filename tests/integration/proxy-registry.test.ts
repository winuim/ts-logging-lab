import puppeteer from 'puppeteer';
import { expect, test, vi } from 'vitest';
import { unwrap, withPageLogging } from '../../src/index.js';

test('実Pageのkeyboard・メソッド参照が安定し、イベント解除できる', async () => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const raw = await browser.newPage();
    const page = withPageLogging(raw);
    expect(withPageLogging(page)).toBe(page);
    expect(unwrap(page)).toBe(raw);
    expect(page.keyboard).toBe(page.keyboard);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- 呼び出さずにキャッシュの参照同一性を検証する。
    expect(page.goto).toBe(page.goto);
    const handler = vi.fn();
    expect(page.on('close', handler)).toBe(page);
    page.off('close', handler);
    await page.close();
    expect(handler).not.toHaveBeenCalled();
  } finally {
    await browser.close();
  }
}, 20_000);
