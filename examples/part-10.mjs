import puppeteer from 'puppeteer';
import pino from 'pino';
import {
  ConsoleAdapter,
  PinoAdapter,
  createDiagnosticLogger,
  subscribePageDiagnostics,
} from '../dist/index.js';

const browser = await puppeteer.launch({ headless: true });
try {
  for (const adapter of [
    new ConsoleAdapter(),
    new PinoAdapter(pino({ base: null })),
  ]) {
    const page = await browser.newPage();
    const dispose = subscribePageDiagnostics(
      page,
      createDiagnosticLogger({ adapter, category: 'browser' }),
    );
    try {
      const error = new Promise((resolve) => page.once('pageerror', resolve));
      await page.evaluate(() => {
        globalThis.setTimeout(() => {
          throw new Error('dummy-private-error');
        }, 0);
      });
      await error;
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        void request.abort();
      });
      const failed = new Promise((resolve) =>
        page.once('requestfailed', resolve),
      );
      await page.evaluate(() => {
        void globalThis
          .fetch('https://example.test/dummy-token')
          .catch(() => undefined);
      });
      await failed;
    } finally {
      dispose();
      await page.close();
    }
  }
} finally {
  await browser.close();
}
