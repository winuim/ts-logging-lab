import console from 'node:console';

import puppeteer from 'puppeteer';

import { withPageLogging } from '../dist/index.js';

const browser = await puppeteer.launch({ headless: true });
try {
  const raw = await browser.newPage();
  const page = withPageLogging(raw);
  const response = await page.goto('about:blank');
  console.log('about:blankの応答:', response);
  console.log('keyboardは実体と同じ:', page.keyboard === raw.keyboard);
  console.log('未ラップのevaluate:', await page.evaluate(() => 6 * 7));

  try {
    await page.goto('not-a-valid-url');
  } catch {
    console.log('不正URLの失敗を呼び出し側で処理しました。');
  }
} finally {
  await browser.close();
}
