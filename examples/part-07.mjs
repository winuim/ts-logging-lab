import console from 'node:console';
import { setTimeout } from 'node:timers/promises';
import puppeteer from 'puppeteer';
import { withBrowserLogging, withLog, withRunContext } from '../dist/index.js';

// ラッパーは処理の入口より外で一度だけ作成する。
const work = withLog(
  'example.work',
  async () => {
    await setTimeout(10);
    return 42;
  },
  { category: 'batch', levels: { start: 'debug', success: 'debug' } },
);
console.log(
  '並行処理の結果:',
  await Promise.all([
    withRunContext({ runId: 'run-A' }, () => work()),
    withRunContext({ runId: 'run-B' }, () => work()),
  ]),
);

const raw = await puppeteer.launch({ headless: true });
try {
  const browser = withBrowserLogging(raw, {
    category: 'browser',
    levels: { start: 'debug', success: 'debug' },
  });
  const page = await browser.newPage(); // 文脈なし: runIdを含めない
  const keyboard = page.keyboard;
  const input = page.locator('input').setTimeout(1000);
  for (const runId of ['scenario-A', 'scenario-B']) {
    await withRunContext({ runId }, async () => {
      await page.goto('about:blank');
      await page.setContent('<input>');
      await page.focus('input');
      await keyboard.type('dummy-input');
      await input.fill('dummy-replaced');
    });
  }
  const reason = new Error('dummy-secret');
  const fail = withLog('example.fail', () => Promise.reject(reason));
  await withRunContext({ runId: 'outer' }, async () => {
    try {
      await withRunContext({ runId: 'inner' }, () => fail());
    } catch (error) {
      console.log('元の拒否理由を保持:', error === reason);
    }
    await work(); // outerへ復元
  });
  await work(); // 文脈なしへ復元
} finally {
  await raw.close();
}
