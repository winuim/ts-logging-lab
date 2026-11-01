import assert from 'node:assert/strict';
import process from 'node:process';
import pino from 'pino';
import puppeteer from 'puppeteer';
import {
  ConsoleAdapter,
  PinoAdapter,
  createDiagnosticLogger,
  subscribePageDiagnostics,
  withPageLogging,
  withRunContext,
} from '../dist/index.js';

const mode = process.argv[2] ?? 'console';
assert.ok(['console', 'pino-debug', 'pino-info'].includes(mode));
const adapter =
  mode === 'console'
    ? new ConsoleAdapter()
    : new PinoAdapter(
        pino({
          base: null,
          level: mode === 'pino-debug' ? 'debug' : 'info',
          redact: {
            paths: ['attributes.dummySecret'],
            censor: '[REDACTED]',
          },
        }),
      );
const diagnostic = createDiagnosticLogger({ adapter, category: 'browser' });
const options = {
  adapter,
  category: 'browser',
  levels: { start: 'debug', success: 'debug' },
  extractor: {
    start: (args) => ({ argumentCount: args.length }),
    success: (result) => ({ isNull: result === null }),
    failure: () => ({ errorType: 'navigation-failed' }),
  },
};

// 実行例の待機用。通知を先に購読し、失敗時もリスナーとタイマーを外す。
async function triggerAndWait(page, event, trigger) {
  const signal = Promise.withResolvers();
  const handler = () => signal.resolve();
  const timer = globalThis.setTimeout(
    () => signal.reject(new Error('Expected diagnostic event')),
    5000,
  );
  page.once(event, handler);
  try {
    await Promise.all([signal.promise, trigger()]);
  } finally {
    globalThis.clearTimeout(timer);
    page.off(event, handler);
  }
}

const browser = await puppeteer.launch({ headless: true });
try {
  const rawPages = await Promise.all([browser.newPage(), browser.newPage()]);
  const pages = rawPages.map((page) => withPageLogging(page, options));
  await Promise.all(
    pages.map((page, index) =>
      withRunContext({ runId: `run-${index + 1}` }, async () => {
        assert.equal(await page.goto('about:blank'), null);
      }),
    ),
  );
  await withRunContext({ runId: 'run-1' }, async () => {
    await assert.rejects(() => pages[0].goto('not-a-valid-url'));
  });

  for (const raw of rawPages) {
    const before = ['pageerror', 'requestfailed'].map((e) =>
      raw.listenerCount(e),
    );
    const dispose = subscribePageDiagnostics(raw, diagnostic);
    try {
      // 同じPageの教材Proxyから購読しても重複しない。
      assert.equal(
        subscribePageDiagnostics(withPageLogging(raw, options), diagnostic),
        dispose,
      );
      await triggerAndWait(raw, 'pageerror', () =>
        raw.evaluate(() => {
          globalThis.setTimeout(() => {
            throw new Error('dummy-private-error');
          }, 0);
        }),
      );
      await raw.setRequestInterception(true);
      const abort = (request) => {
        void request.abort().catch(() => undefined);
      };
      raw.on('request', abort);
      try {
        await triggerAndWait(raw, 'requestfailed', () =>
          raw.evaluate(() => {
            void globalThis
              .fetch('https://example.test/dummy-token')
              .catch(() => undefined);
          }),
        );
      } finally {
        raw.off('request', abort);
        await raw.setRequestInterception(false);
      }
    } finally {
      dispose();
      assert.deepEqual(
        ['pageerror', 'requestfailed'].map((e) => raw.listenerCount(e)),
        before,
      );
    }
  }
  // Redactionの比較専用。実データを抽出せず、明示的なダミー値だけを渡す。
  withRunContext({ runId: 'run-probe' }, () => {
    diagnostic.log('example.redaction', 'warning', {
      dummySecret: 'dummy-redaction-probe',
    });
  });
} finally {
  await browser.close();
}
