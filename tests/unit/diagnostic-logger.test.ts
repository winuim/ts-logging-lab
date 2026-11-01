import { EventEmitter } from 'node:events';
import pino from 'pino';
import { afterEach, expect, test, vi } from 'vitest';
import {
  ConsoleAdapter,
  PinoAdapter,
  createDiagnosticLogger,
  subscribePageDiagnostics,
  withRunContext,
} from '../../src/index.js';
import type { LogRecord } from '../../src/index.js';

afterEach(() => vi.restoreAllMocks());

test('Console/Pinoは診断イベントを共通出力し、操作フィールドを作らない', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const lines: string[] = [];
  const adapters = [
    new ConsoleAdapter(),
    new PinoAdapter(
      pino(
        { base: null },
        {
          write(line: string) {
            lines.push(line);
          },
        },
      ),
    ),
  ];
  for (const adapter of adapters) {
    createDiagnosticLogger({ adapter, category: 'browser' }).log(
      'puppeteer.requestfailed',
      'warning',
      { count: 1 },
    );
  }
  const consoleRecord: unknown = JSON.parse(String(warn.mock.calls[0]?.[0]));
  const pinoRecord: unknown = JSON.parse(lines[0] ?? 'null');
  for (const record of [consoleRecord, pinoRecord]) {
    expect(record).toMatchObject({
      kind: 'diagnostic',
      event: 'puppeteer.requestfailed',
      category: 'browser',
      attributes: { count: 1 },
    });
    for (const key of [
      'phase',
      'operation',
      'operationId',
      'durationMs',
      'runId',
    ])
      expect(record).not.toHaveProperty(key);
  }
  expect(consoleRecord).toMatchObject({
    level: 'warning',
    message: 'Diagnostic event',
  });
  expect(pinoRecord).toMatchObject({ level: 40, msg: 'Diagnostic event' });
});

test('属性は浅くコピーし型契約外の値とtoJSONを取り込まない', () => {
  const records: LogRecord[] = [];
  const logger = createDiagnosticLogger({
    adapter: {
      emit: (e) => {
        records.push(e);
      },
    },
  });
  const attributes = {
    count: 1,
    nested: { secret: 'dummy-secret' },
    toJSON: () => 'dummy-secret',
    invalid: Infinity,
  };
  logger.log('sample', 'info', { count: attributes.count });
  // @ts-expect-error JSから型契約外の属性を渡す場合の実行時検証
  logger.log('sample', 'info', attributes);
  attributes.count = 9;
  expect(records.map((e) => e.attributes)).toEqual([
    { count: 1 },
    { count: 1 },
  ]);
  expect(JSON.stringify(records)).not.toContain('dummy-secret');
  logger.log('sample', 'info', {
    get count(): number {
      throw new Error('dummy-secret');
    },
  });
  expect(records).toHaveLength(2);
});

test('同期throwと非同期rejectを隔離し次の診断通知を継続する', async () => {
  for (const emit of [
    vi.fn(() => {
      throw new Error('output');
    }),
    vi.fn(() => Promise.reject(new Error('output'))),
  ]) {
    const logger = createDiagnosticLogger({ adapter: { emit } });
    expect(() => {
      logger.log('sample', 'error');
    }).not.toThrow();
    logger.log('sample', 'error');
    await Promise.resolve();
    expect(emit).toHaveBeenCalledTimes(2);
  }
});

test('Pinoの抑制・Redactionは設定した出力だけに適用される', () => {
  const lines: string[] = [];
  const logger = createDiagnosticLogger({
    adapter: new PinoAdapter(
      pino(
        { level: 'warn', redact: ['attributes.email'] },
        {
          write(line: string) {
            lines.push(line);
          },
        },
      ),
    ),
  });
  logger.log('sample', 'info');
  logger.log('sample', 'warning', { email: 'dummy-email', label: 'safe' });
  expect(lines).toHaveLength(1);
  expect(lines[0]).not.toContain('dummy-email');
  expect(lines[0]).toContain('safe');
});

test('購読は重複を防ぎ、解除は冪等、再購読と別Pageも独立する', () => {
  const page = new EventEmitter();
  const other = new EventEmitter();
  const log = vi.fn();
  const dispose = subscribePageDiagnostics(page, { log });
  expect(subscribePageDiagnostics(page, { log: vi.fn() })).toBe(dispose);
  const disposeOther = subscribePageDiagnostics(other, { log });
  page.emit('pageerror', new Error('dummy-secret'));
  page.emit('requestfailed', {
    url: () => {
      throw new Error('must not read');
    },
  });
  expect(log.mock.calls).toEqual([
    ['puppeteer.pageerror', 'error'],
    ['puppeteer.requestfailed', 'warning'],
  ]);
  dispose();
  dispose();
  expect(page.listenerCount('pageerror')).toBe(0);
  expect(page.listenerCount('requestfailed')).toBe(0);
  expect(other.listenerCount('pageerror')).toBe(1);
  const again = subscribePageDiagnostics(page, {
    log: () => {
      throw new Error('handler');
    },
  });
  expect(() => page.emit('pageerror', undefined)).not.toThrow();
  again();
  disposeOther();
});

test('部分登録の失敗では登録済みリスナーを解除する', () => {
  class FailingPage extends EventEmitter {
    override on(event: string, listener: (...args: unknown[]) => void): this {
      if (event === 'requestfailed') throw new Error('registration');
      return super.on(event, listener);
    }
  }
  const page = new FailingPage();
  expect(() => subscribePageDiagnostics(page, { log: vi.fn() })).toThrow(
    'registration',
  );
  expect(page.listenerCount('pageerror')).toBe(0);
});

test('runIdは登録時ではなく発火時に取得し、await・並行文脈と文脈外を区別する', async () => {
  const page = new EventEmitter();
  const records: LogRecord[] = [];
  const logger = createDiagnosticLogger({
    adapter: {
      emit: (e) => {
        records.push(e);
      },
    },
  });
  const dispose = withRunContext({ runId: 'registration' }, () =>
    subscribePageDiagnostics(page, logger),
  );
  await Promise.all(
    ['A', 'B'].map((runId) =>
      withRunContext({ runId }, async () => {
        await Promise.resolve();
        page.emit('pageerror');
      }),
    ),
  );
  page.emit('pageerror');
  expect(records.map((e) => e.runId)).toEqual(['A', 'B', undefined]);
  dispose();
});
