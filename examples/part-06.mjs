import console from 'node:console';
import puppeteer from 'puppeteer';
import { withBrowserLogging, withLog } from '../dist/index.js';

const options = {
  category: 'browser',
  levels: { start: 'debug', success: 'debug' },
};
const work = withLog('example.work', () => Promise.resolve(42), options);
console.log('解決値:', await work());
const reason = new Error('dummy-secret');
const fail = withLog('example.fail', () => Promise.reject(reason), options);
try {
  await fail();
} catch (error) {
  console.log('元の拒否理由を保持:', error === reason);
}

const raw = await puppeteer.launch({ headless: true });
try {
  const browser = withBrowserLogging(raw, options);
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.setContent('<input id="field">');
  await page.focus('#field');
  await page.keyboard.type('dummy-input');
  await page.locator('input').setTimeout(1000).fill('dummy-replaced');
  console.log(
    '子ラッパーとチェーンを通じた操作成功:',
    await page.$eval('input', (input) => input.value === 'dummy-replaced'),
  );
} finally {
  await raw.close();
}
