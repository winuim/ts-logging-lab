import { createServer } from 'node:http';
import { once } from 'node:events';
import puppeteer from 'puppeteer';
import { expect, test, vi } from 'vitest';
import {
  subscribeDiagnostics,
  ResourceContext,
  withPageLogging,
} from '../../src/index.js';
import type { LogEvent } from '../../src/index.js';

test('HTTP404と操作成功を分け、生のURL/本文/console/例外を収集しない', async () => {
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/fail')) {
      request.socket.destroy();
      return;
    }
    response.writeHead(404, {
      'Content-Type': 'text/html',
      'Set-Cookie': 'dummy-cookie-secret',
    });
    response.end('<html>dummy-body-secret</html>');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected TCP port');
  const browser = await puppeteer.launch({ headless: true });
  const events: LogEvent[] = [];
  const adapter = {
    emit(event: LogEvent) {
      events.push(event);
    },
  };
  const resources = new ResourceContext();
  try {
    const raw = await browser.newPage();
    const page = withPageLogging(raw, { resources, adapter });
    const dispose = subscribeDiagnostics(page, { resources, adapter });
    expect(
      subscribeDiagnostics(raw, {
        adapter: {
          emit() {
            throw new Error('unused');
          },
        },
      }),
    ).toBe(dispose);
    const result = await page.goto(
      `http://127.0.0.1:${String(address.port)}/dummy-url-secret?token=dummy-token-secret`,
    );
    expect(result?.status()).toBe(404);
    await page.evaluate(() => {
      console.log('dummy-console-secret');
      setTimeout(() => {
        throw new Error('dummy-error-secret');
      }, 0);
    });
    await expect
      .poll(() => events.some((event) => event.eventId === 'page.exception'))
      .toBe(true);
    expect(events.some((event) => event.eventId === 'operation.success')).toBe(
      true,
    );
    expect(
      events.some(
        (event) =>
          event.eventId === 'http.response' &&
          event.attributes['httpStatus'] === 404 &&
          event.phase === 'diagnostic',
      ),
    ).toBe(true);
    expect(events.some((event) => event.eventId === 'page.console')).toBe(true);
    await expect(
      page.goto(`http://127.0.0.1:${String(address.port)}/fail`),
    ).rejects.toBeDefined();
    await expect
      .poll(() => events.some((event) => event.eventId === 'http.failed'))
      .toBe(true);
    for (const secret of [
      'dummy-url-secret',
      'dummy-token-secret',
      'dummy-body-secret',
      'dummy-cookie-secret',
      'dummy-console-secret',
      'dummy-error-secret',
    ]) {
      expect(JSON.stringify(events)).not.toContain(secret);
    }
    const previous = events.filter(
      (event) => event.eventId === 'page.exception',
    ).length;
    raw.emit('pageerror', new Error('dummy-emitted-secret'));
    expect(
      events.filter((event) => event.eventId === 'page.exception'),
    ).toHaveLength(previous + 1);
    dispose();
    dispose();
    raw.emit('pageerror', new Error('after-unsubscribe'));
    expect(
      events.filter((event) => event.eventId === 'page.exception'),
    ).toHaveLength(previous + 1);
    expect(raw.listenerCount('pageerror')).toBe(0);
    const again = subscribeDiagnostics(raw, { resources, adapter });
    expect(again).not.toBe(dispose);
    await raw.close();
    expect(raw.listenerCount('pageerror')).toBe(0);
    again();
    expect(() => subscribeDiagnostics(raw)).toThrow('closed page');
  } finally {
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

test('複数Pageは別IDで購読し、一方の解除と出力失敗を隔離する', async () => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const a = await browser.newPage();
    const b = await browser.newPage();
    const resources = new ResourceContext();
    const events: LogEvent[] = [];
    const adapter = {
      emit(event: LogEvent) {
        events.push(event);
      },
    };
    const offA = subscribeDiagnostics(a, {
      resources,
      adapter,
      levelOverrides: { 'page.exception': 'warning' },
    });
    const offB = subscribeDiagnostics(b, { resources, adapter });
    a.emit('pageerror', new Error('a'));
    b.emit('pageerror', new Error('b'));
    expect(events).toHaveLength(2);
    expect(events[0]?.attributes['resourceId']).not.toBe(
      events[1]?.attributes['resourceId'],
    );
    expect(events[0]?.level).toBe('warning');
    offA();
    a.emit('pageerror', new Error('ignored'));
    b.emit('pageerror', new Error('b'));
    expect(events).toHaveLength(3);
    offB();
    const offFailed = subscribeDiagnostics(a, {
      adapter: {
        emit() {
          throw new Error('sink');
        },
      },
      correlation: () => {
        throw new Error('context');
      },
    });
    expect(() => a.emit('pageerror', new Error('private'))).not.toThrow();
    expect(await a.evaluate(() => 42)).toBe(42);
    offFailed();
  } finally {
    await browser.close();
  }
}, 20_000);

test('部分登録の失敗は既に登録したリスナーも外す', async () => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const original = page.on.bind(page);
    const spy = vi.spyOn(page, 'on');
    spy.mockImplementationOnce((event, handler) => original(event, handler));
    spy.mockImplementationOnce(() => {
      throw new Error('registration');
    });
    expect(() => subscribeDiagnostics(page)).toThrow('registration');
    spy.mockRestore();
    expect(page.listenerCount('response')).toBe(0);
    expect(page.listenerCount('pageerror')).toBe(0);
    const off = subscribeDiagnostics(page);
    expect(page.listenerCount('pageerror')).toBe(1);
    off();
  } finally {
    await browser.close();
  }
}, 20_000);
