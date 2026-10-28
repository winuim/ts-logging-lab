import { createServer } from 'node:http';
import { once } from 'node:events';
import { configureSync } from '@logtape/logtape';
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import puppeteer from 'puppeteer';
import { expect, test } from 'vitest';
import {
  ResourceContext,
  navigationContext,
  openTelemetryCorrelation,
  subscribeDiagnostics,
  withPageLogging,
} from '../../src/index.js';

test('実Pageの並列操作をLogTapeまで追い、診断経路にも秘密を出さない', async () => {
  const records: Readonly<Record<string, unknown>>[] = [];
  configureSync({
    reset: true,
    sinks: {
      capture(record) {
        records.push(record.properties);
      },
    },
    loggers: [
      {
        category: ['ts-logging-lab'],
        lowestLevel: 'debug',
        sinks: ['capture'],
      },
      { category: ['logtape', 'meta'], lowestLevel: 'error', sinks: [] },
    ],
  });
  const secret = 'dummy-browser-regression-secret';
  const server = createServer((_request, response) => {
    response.writeHead(404, {
      'Content-Type': 'text/html',
      'Set-Cookie': secret,
    });
    response.end(`<html>${secret}<input id="password" type="password"></html>`);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected TCP port');
  const origin = `http://127.0.0.1:${String(address.port)}`;
  const browser = await puppeteer.launch({ headless: true });
  const provider = new TracerProvider();
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  );
  trace.setGlobalTracerProvider(provider);
  const resources = new ResourceContext();
  const expected = new Map<string, string>();
  try {
    const pages = await Promise.all([browser.newPage(), browser.newPage()]);
    await Promise.all(
      pages.map((raw) =>
        provider
          .getTracer('browser-regression')
          .startActiveSpan('flow', async (span) => {
            const page = withPageLogging(raw, {
              resources,
              correlation: openTelemetryCorrelation,
              extractor: navigationContext([origin]),
            });
            const resourceId = resources.id(raw, 'page');
            expected.set(resourceId, span.spanContext().spanId);
            const off = subscribeDiagnostics(page, {
              resources,
              correlation: openTelemetryCorrelation,
            });
            try {
              await page.goto(`${origin}/${secret}?token=${secret}#${secret}`);
              await page.evaluate((value) => {
                const input = document.querySelector('input');
                if (input) input.value = value;
                console.log(value);
              }, secret);
              raw.emit('pageerror', new Error(secret));
            } finally {
              off();
              span.end();
            }
          }),
      ),
    );
    expect(expected.size).toBe(2);
    for (const [resourceId, spanId] of expected) {
      const own = records.filter(
        (record) =>
          record['operation'] === 'page.goto' &&
          record['resourceId'] === resourceId,
      );
      expect(own).toHaveLength(2);
      expect(own.every((record) => record['spanId'] === spanId)).toBe(true);
      expect(own.some((record) => record['phase'] === 'success')).toBe(true);
      expect(
        records.some(
          (record) =>
            record['eventId'] === 'http.response' &&
            record['resourceId'] === resourceId &&
            record['httpStatus'] === 404,
        ),
      ).toBe(true);
    }
    expect(new Set(expected.values()).size).toBe(2);
    expect(JSON.stringify(records)).not.toContain(secret);
    expect(pages.every((page) => page.listenerCount('pageerror') === 0)).toBe(
      true,
    );
  } finally {
    await provider.shutdown();
    context.disable();
    trace.disable();
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      }),
    );
  }
}, 30_000);
