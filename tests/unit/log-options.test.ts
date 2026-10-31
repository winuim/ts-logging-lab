import { afterEach, expect, test, vi } from 'vitest';
import {
  ConsoleAdapter,
  createEmitter,
  createLoggingProxy,
  withLog,
  withPageLogging,
} from '../../src/index.js';
import type {
  EmitterOptions,
  LogEvent,
  LogOptions,
  OperationEvent,
} from '../../src/index.js';

afterEach(() => vi.restoreAllMocks());

const phases = ['start', 'success', 'failure'] as const;

test.each([
  { options: {}, expected: ['info', 'info', 'error'] },
  { options: { levels: {} }, expected: ['info', 'info', 'error'] },
  {
    options: { levels: { start: 'debug' } },
    expected: ['debug', 'info', 'error'],
  },
  {
    options: { levels: { success: 'warning' } },
    expected: ['info', 'warning', 'error'],
  },
  {
    options: { levels: { failure: 'warning' } },
    expected: ['info', 'info', 'warning'],
  },
  {
    options: {
      levels: { start: 'debug', success: 'warning', failure: 'info' },
    },
    expected: ['debug', 'warning', 'info'],
  },
  {
    options: { category: undefined, levels: undefined },
    expected: ['info', 'info', 'error'],
  },
  {
    options: {
      levels: { start: undefined, success: undefined, failure: undefined },
    },
    expected: ['info', 'info', 'error'],
  },
  {
    options: { levels: { start: 'debug', success: undefined } },
    expected: ['debug', 'info', 'error'],
  },
] satisfies { options: EmitterOptions; expected: string[] }[])(
  'フェーズ別のレベルを決め、未指定値は既定値へ戻す: $options',
  ({ options, expected }) => {
    const events: LogEvent[] = [];
    const emit = createEmitter(
      {
        emit: (event) => {
          events.push(event);
        },
      },
      options,
    );
    for (const phase of phases) emit({ operation: 'work', phase });
    expect(events.map((event) => event.level)).toEqual(expected);
    expect(events.map((event) => event.message)).toEqual([
      'Operation started',
      'Operation succeeded',
      'Operation failed',
    ]);
  },
);

test.each([undefined, 'browser', ''])(
  'カテゴリは指定された場合だけイベントとJSONに含める: %s',
  (category) => {
    const events: LogEvent[] = [];
    const emit = createEmitter(
      {
        emit: (event) => {
          events.push(event);
        },
      },
      { category },
    );
    for (const phase of phases) emit({ operation: 'page.goto', phase });
    for (const event of events) {
      expect(Object.hasOwn(event, 'category')).toBe(category !== undefined);
      expect(JSON.stringify(event)).toBe(
        JSON.stringify({
          operation: 'page.goto',
          phase: event.phase,
          ...(category === undefined ? {} : { category }),
          level: event.level,
          message: event.message,
        }),
      );
    }
  },
);

test('並行するラッパーの設定と既定値が混ざらない', async () => {
  const events: LogEvent[] = [];
  const adapter = {
    emit: (event: LogEvent) => {
      events.push(event);
    },
  };
  const configured = withLog('configured', () => Promise.resolve(1), {
    adapter,
    category: 'browser',
    levels: { start: 'debug', success: 'debug' },
  });
  const other = withLog('other', () => Promise.resolve(2), {
    adapter,
    category: 'storage',
    levels: { success: 'warning' },
  });
  const defaults = withLog('defaults', () => Promise.resolve(3), { adapter });
  expect(await Promise.all([configured(), other(), defaults()])).toEqual([
    1, 2, 3,
  ]);
  expect(
    events
      .filter((event) => event.operation === 'configured')
      .map((event) => [event.category, event.level]),
  ).toEqual([
    ['browser', 'debug'],
    ['browser', 'debug'],
  ]);
  expect(
    events
      .filter((event) => event.operation === 'other')
      .map((event) => [event.category, event.level]),
  ).toEqual([
    ['storage', 'info'],
    ['storage', 'warning'],
  ]);
  const defaultEvents = events.filter(
    (event) => event.operation === 'defaults',
  );
  expect(defaultEvents.map((event) => event.level)).toEqual(['info', 'info']);
  expect(
    defaultEvents.every((event) => !Object.hasOwn(event, 'category')),
  ).toBe(true);
});

test('withLogの設定レベルでConsoleAdapterの出力メソッドを選ぶ', async () => {
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const options: LogOptions = {
    category: 'browser',
    levels: { start: 'debug', success: 'warning' },
  };
  await withLog('ok', () => Promise.resolve(42), options)();
  const reason = new Error('dummy-token');
  await expect(
    withLog('fail', () => Promise.reject(reason), options)(),
  ).rejects.toBe(reason);
  expect(debug).toHaveBeenCalledTimes(2);
  expect(warn).toHaveBeenCalledExactlyOnceWith(
    expect.stringContaining('"level":"warning"'),
  );
  expect(error).toHaveBeenCalledExactlyOnceWith(
    expect.stringContaining('"level":"error"'),
  );
  expect(info).not.toHaveBeenCalled();
  for (const spy of [debug, warn, error]) {
    for (const [json] of spy.mock.calls) {
      expect(json).toEqual(expect.stringContaining('"category":"browser"'));
    }
  }
  expect(JSON.stringify(error.mock.calls)).not.toContain('dummy-token');
});

test('設定があっても入力の秘密属性やtoJSONを出力へコピーしない', () => {
  const output = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  const toJSON = vi.fn(() => 'dummy-authorization');
  const event: OperationEvent & {
    args: string[];
    result: string;
    error: Error;
    toJSON: typeof toJSON;
    category: string;
    level: string;
  } = {
    operation: 'work',
    phase: 'success',
    durationMs: 1,
    args: ['dummy-password'],
    result: 'dummy-token',
    error: new Error('dummy-cookie'),
    toJSON,
    category: 'dummy-category',
    level: 'error',
  };
  createEmitter(new ConsoleAdapter(), {
    category: 'browser',
    levels: { success: 'debug' },
  })(event);
  expect(toJSON).not.toHaveBeenCalled();
  expect(output).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({
      operation: 'work',
      phase: 'success',
      durationMs: 1,
      category: 'browser',
      level: 'debug',
      message: 'Operation succeeded',
    }),
  );
  expect(event.args).toEqual(['dummy-password']);
});

test('Proxyの初回設定・メソッドキャッシュ・引数と結果を維持する', async () => {
  const events: LogEvent[] = [];
  const ignored = vi.fn();
  const input = { secret: 'dummy-password' };
  const result = { secret: 'dummy-token' };
  const reason = new Error('dummy-cookie');
  const raw = {
    run(value: typeof input) {
      expect(this).toBe(raw);
      expect(value).toBe(input);
      return Promise.resolve(result);
    },
    fail() {
      return Promise.reject(reason);
    },
  };
  const proxy = createLoggingProxy(raw, {
    name: 'work',
    asyncMethods: ['run', 'fail'],
    adapter: {
      emit: (event) => {
        events.push(event);
      },
    },
    category: 'browser',
    levels: { start: 'debug', success: 'debug' },
  });
  expect(
    createLoggingProxy(raw, {
      name: 'ignored',
      asyncMethods: [],
      adapter: { emit: ignored },
      category: 'ignored',
    }),
  ).toBe(proxy);
  // eslint-disable-next-line @typescript-eslint/unbound-method -- 呼び出さずにメソッドキャッシュを検証する。
  expect(proxy.run).toBe(proxy.run);
  expect(await proxy.run(input)).toBe(result);
  await expect(proxy.fail()).rejects.toBe(reason);
  expect(ignored).not.toHaveBeenCalled();
  expect(
    events.map((event) => [
      event.operation,
      event.phase,
      event.category,
      event.level,
    ]),
  ).toEqual([
    ['work.run', 'start', 'browser', 'debug'],
    ['work.run', 'success', 'browser', 'debug'],
    ['work.fail', 'start', 'browser', 'debug'],
    ['work.fail', 'failure', 'browser', 'error'],
  ]);
  expect(JSON.stringify(events)).not.toContain('dummy-');
});

test('Pageラッパーもカテゴリ・レベル・Adapterを引き継ぐ', async () => {
  const events: LogEvent[] = [];
  const raw = { goto: () => Promise.resolve(null) };
  const page = withPageLogging(raw, {
    adapter: {
      emit: (event) => {
        events.push(event);
      },
    },
    category: 'browser',
    levels: { start: 'debug', success: 'debug' },
  });
  expect(withPageLogging(page, { category: 'ignored' })).toBe(page);
  expect(await page.goto()).toBeNull();
  expect(events.map((event) => [event.category, event.level])).toEqual([
    ['browser', 'debug'],
    ['browser', 'debug'],
  ]);
});
