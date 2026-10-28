import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from 'vitest';

import { withPageLogging } from '../../src/index.js';

let browser: Browser | undefined;
let raw: Page | undefined;

beforeAll(async () => {
  browser = await puppeteer.launch({ headless: true });
});

beforeEach(async () => {
  if (!browser) throw new Error('Browser is not initialized');
  raw = await browser.newPage();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(async () => {
  try {
    if (raw && !raw.isClosed()) await raw.close();
  } finally {
    raw = undefined;
    vi.restoreAllMocks();
  }
});

afterAll(async () => {
  await browser?.close();
});

function currentPage(): Page {
  if (!raw) throw new Error('Page is not initialized');
  return raw;
}

test('実Pageでも素朴なProxyは#privateのgetter・メソッドを壊す', () => {
  const naive = new Proxy(currentPage(), {});
  expect(() => naive.keyboard).toThrow(TypeError);
  expect(() => naive.mainFrame()).toThrow(TypeError);
});

test('実Pageのgoto・keyboard・未ラップメソッドが動く', async () => {
  const original = currentPage();
  const page = withPageLogging(original);
  expect(await page.goto('about:blank', { waitUntil: 'load' })).toBeNull();
  expect(page.keyboard).not.toBe(original.keyboard);
  expect(page.mainFrame()).toBe(original.mainFrame());
  await page.setContent('<input id="field"><title>Proxy test</title>');
  await page.focus('#field');
  await page.keyboard.type('dummy-input');
  expect(await page.$eval('input#field', (element) => element.value)).toBe(
    'dummy-input',
  );
  expect(await page.title()).toBe('Proxy test');
  expect(await page.evaluate(() => 6 * 7)).toBe(42);
  expect(page.url()).toBe('about:blank');
  expect(console.info).toHaveBeenCalledTimes(4);
});

test('実PageのHTTPResponseを同じオブジェクトで返す', async () => {
  const original = currentPage();
  const goto = vi.spyOn(original, 'goto');
  const page = withPageLogging(original);
  const url = 'data:text/html,<title>response</title>';
  const response = await page.goto(url);
  expect(response).not.toBeNull();
  expect(response?.url()).toBe(url);
  expect(response).toBe(await goto.mock.results[0]?.value);
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(url);
});

test('実Pageのgotoが返す拒否理由を置き換えない', async () => {
  const original = currentPage();
  const error = new Error('dummy-secret');
  vi.spyOn(original, 'goto').mockRejectedValueOnce(error);
  const page = withPageLogging(original);
  await expect(page.goto('about:blank')).rejects.toBe(error);
  expect(console.info).toHaveBeenLastCalledWith(
    expect.stringMatching(/^page.goto: failure \(\d+\.\d{2} ms\)$/),
  );
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
    'dummy-secret',
  );
});

test('実際の不正URLも失敗ログを出してrejectする', async () => {
  const page = withPageLogging(currentPage());
  await expect(page.goto('not-a-valid-url')).rejects.toBeInstanceOf(Error);
  expect(console.info).toHaveBeenLastCalledWith(
    expect.stringMatching(/^page.goto: failure \(\d+\.\d{2} ms\)$/),
  );
  expect(console.info).toHaveBeenCalledTimes(2);
});
