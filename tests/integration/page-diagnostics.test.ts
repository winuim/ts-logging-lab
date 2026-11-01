import puppeteer from 'puppeteer';
import { expect, test } from 'vitest';
import {
  createDiagnosticLogger,
  subscribePageDiagnostics,
  withPageLogging,
  withRunContext,
} from '../../src/index.js';
import type { LogRecord } from '../../src/index.js';

test('実Chromeのpageerror/requestfailedを安全に記録し、Proxyとの重複と解除を検証する', async () => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const records: LogRecord[] = [];
    const logger = createDiagnosticLogger({
      adapter: {
        emit: (e) => {
          records.push(e);
        },
      },
    });
    const beforeError = page.listenerCount('pageerror');
    const beforeRequest = page.listenerCount('requestfailed');
    const dispose = withRunContext({ runId: 'registration' }, () =>
      subscribePageDiagnostics(page, logger),
    );
    expect(subscribePageDiagnostics(withPageLogging(page), logger)).toBe(
      dispose,
    );
    expect(page.listenerCount('pageerror')).toBe(beforeError + 1);
    try {
      const error = new Promise<void>((resolve) =>
        page.once('pageerror', () => {
          resolve();
        }),
      );
      await page.evaluate(() => {
        setTimeout(() => {
          throw new Error('dummy-private-error');
        }, 0);
      });
      await error;
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        void request.abort();
      });
      const failed = new Promise<void>((resolve) =>
        page.once('requestfailed', () => {
          resolve();
        }),
      );
      await page.evaluate(() => {
        void fetch('https://example.test/dummy-secret?token=dummy-token').catch(
          () => undefined,
        );
      });
      await failed;
      expect(
        records.map((e) => (e.kind === 'diagnostic' ? e.event : e.operation)),
      ).toEqual(['puppeteer.pageerror', 'puppeteer.requestfailed']);
      for (const record of records) {
        expect(record).not.toHaveProperty('phase');
        expect(record.runId).not.toBe('registration');
      }
      expect(JSON.stringify(records)).not.toContain('dummy-');
      expect(JSON.stringify(records)).not.toContain('example.test');
    } finally {
      dispose();
    }
    expect(page.listenerCount('pageerror')).toBe(beforeError);
    expect(page.listenerCount('requestfailed')).toBe(beforeRequest);
    const finished = new Promise<void>((resolve) =>
      page.once('pageerror', () => {
        resolve();
      }),
    );
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('dummy-after-dispose');
      }, 0);
    });
    await finished;
    expect(records).toHaveLength(2);
  } finally {
    await browser.close();
  }
});
