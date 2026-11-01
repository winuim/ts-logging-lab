import console from 'node:console';
import puppeteer from 'puppeteer';
import { withBrowserLogging } from '../dist/index.js';

const raw = await puppeteer.launch({ headless: true });
try {
  const browser = withBrowserLogging(raw);
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.setContent('<input id="field">');
  await page.focus('#field');
  await page.keyboard.type('dummy');
  await page.locator('input').setTimeout(1000).fill('replaced');
  console.log(
    'Locatorのチェーン後も操作成功:',
    await page.$eval('input', (input) => input.value === 'replaced'),
  );
} finally {
  await raw.close();
}
