import { afterEach, expect, expectTypeOf, test, vi } from 'vitest';
import { logRecords } from '../helpers/log-records.js';
import { randomUUID } from 'node:crypto';
import type * as Crypto from 'node:crypto';
import {
  withLog,
  withRunContext,
  createLoggingProxy,
} from '../../src/index.js';
import type {
  ContextExtractor,
  LogAttributes,
  LogEvent,
} from '../../src/index.js';

vi.mock('node:crypto', async (importOriginal) => {
  const original = await importOriginal<typeof Crypto>();
  return { ...original, randomUUID: vi.fn(original.randomUUID) };
});
afterEach(() => vi.mocked(randomUUID).mockReset());

function recorder() {
  const events: LogEvent[] = [];
  return {
    events,
    adapter: {
      emit(event: LogEvent) {
        events.push(event);
      },
    },
  };
}

test.each(['run-A', 'run-B', undefined])(
  '交差する完了順でも呼び出しIDとrunIdを混同しない: %s',
  async (runId) => {
    const { events, adapter } = recorder();
    const first = pendingResult();
    const second = pendingResult();
    const run = withLog('work', (promise: Promise<string>) => promise, {
      adapter,
    });
    const execute = async () => {
      const a = run(first.promise);
      const b = run(second.promise);
      second.resolve('second');
      expect(await b).toBe('second');
      first.resolve('first');
      expect(await a).toBe('first');
    };
    if (runId === undefined) await execute();
    else await withRunContext({ runId }, execute);
    expect(events.map((event) => event.phase)).toEqual([
      'start',
      'start',
      'success',
      'success',
    ]);
    const a = events[0]?.operationId;
    const b = events[1]?.operationId;
    expect(a).toMatch(/^[\da-f-]{36}$/);
    expect(b).not.toBe(a);
    expect(events.map((event) => event.operationId)).toEqual([a, b, b, a]);
    for (const event of events) {
      expect(event.runId).toBe(runId);
      expect(Object.hasOwn(event, 'runId')).toBe(runId !== undefined);
      expect(event).not.toHaveProperty('attributes');
    }
  },
);

test('型推論した引数・結果・拒否理由からフェーズ別の属性だけを選ぶ', async () => {
  const { events, adapter } = recorder();
  const input = { items: ['dummy-password'], secret: 'dummy-token' };
  const result = { count: 1, secret: 'dummy-cookie' };
  const run = withLog(
    'work',
    (arg: typeof input, fail?: boolean) =>
      fail ? Promise.reject(new Error(arg.secret)) : Promise.resolve(result),
    {
      adapter,
      extractor: {
        start(args) {
          expectTypeOf(args).toEqualTypeOf<
            [arg: typeof input, fail?: boolean | undefined]
          >();
          expect(args[0]).toBe(input);
          return { count: args[0].items.length, phase: 'chosen' };
        },
        success(value) {
          expectTypeOf(value).toEqualTypeOf<typeof result>();
          expect(value).toBe(result);
          return { count: value.count, valid: true, missing: null };
        },
        failure(error) {
          expectTypeOf(error).toEqualTypeOf<unknown>();
          return { errorType: error instanceof Error ? error.name : 'unknown' };
        },
      },
    },
  );
  expect(await run(input)).toBe(result);
  await expect(run(input, true)).rejects.toThrow('dummy-token');
  expect(events.map((event) => event.attributes)).toEqual([
    { count: 1, phase: 'chosen' },
    { count: 1, valid: true, missing: null },
    { count: 1, phase: 'chosen' },
    { errorType: 'Error' },
  ]);
  expect(events.map((event) => event.phase)).toEqual([
    'start',
    'success',
    'start',
    'failure',
  ]);
  expect(events[2]?.operationId).toBe(events[3]?.operationId);
  expect(JSON.stringify(events)).not.toContain('dummy-');
  expect(input).toEqual({ items: ['dummy-password'], secret: 'dummy-token' });
});

test.each(['start', 'success', 'failure'] as const)(
  '%sの抽出失敗でもthis・引数・結果・拒否理由とフェーズを保つ',
  async (phase) => {
    const { events, adapter } = recorder();
    const value = { secret: 'dummy-input' };
    const reason = { secret: 'dummy-reason' };
    const receiver = { fail: false };
    const fn = vi.fn(function (this: typeof receiver, arg: typeof value) {
      expect(this).toBe(receiver);
      expect(arg).toBe(value);
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- 拒否理由の同一性を検証する。
      return this.fail ? Promise.reject(reason) : Promise.resolve(value);
    });
    const extractor = {
      [phase]: () => {
        throw new Error('dummy-extractor');
      },
    };
    const run = withLog('work', fn, { adapter, extractor });
    expect(await run.call(receiver, value)).toBe(value);
    receiver.fail = true;
    await expect(run.call(receiver, value)).rejects.toBe(reason);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(events.map((event) => event.phase)).toEqual([
      'start',
      'success',
      'start',
      'failure',
    ]);
    expect(events.every((event) => !Object.hasOwn(event, 'attributes'))).toBe(
      true,
    );
    expect(JSON.stringify(events)).not.toContain('dummy-');
  },
);

test('ID発行失敗はIDを省略し、属性と本体の成否を維持する', async () => {
  vi.mocked(randomUUID).mockImplementation(() => {
    throw new Error('dummy-id');
  });
  const { events, adapter } = recorder();
  const reason = new Error('dummy-reason');
  expect(
    await withLog('ok', () => Promise.resolve(42), {
      adapter,
      extractor: { success: (value) => ({ value }) },
    })(),
  ).toBe(42);
  await expect(
    withLog('fail', () => Promise.reject(reason), { adapter })(),
  ).rejects.toBe(reason);
  expect(events.map((event) => event.phase)).toEqual([
    'start',
    'success',
    'start',
    'failure',
  ]);
  expect(events.every((event) => !Object.hasOwn(event, 'operationId'))).toBe(
    true,
  );
  expect(events[1]?.attributes).toEqual({ value: 42 });
  expect(JSON.stringify(events)).not.toContain('dummy-');
});

test('抽出属性はスナップショットにし、関数・ネストした値を出力しない', async () => {
  const { events, adapter } = recorder();
  const toJSON = vi.fn(() => 'dummy-secret');
  const attrs = {
    count: 1,
    operationId: 'nested-only',
    toJSON,
    nested: { secret: 'dummy-password' },
  };
  // JSから型契約外の戻り値を返した状況を、型アサーションなしで検証する。
  const unsafe = () => attrs;
  // @ts-expect-error 関数やネストした属性は公開契約で拒否する
  const extractor: ContextExtractor = { start: unsafe };
  await withLog('work', () => Promise.resolve(1), { adapter, extractor })();
  attrs.count = 9;
  expect(events[0]?.attributes).toEqual({
    count: 1,
    operationId: 'nested-only',
  });
  expect(events[0]?.operationId).not.toBe('nested-only');
  expect(events[1]).not.toHaveProperty('attributes');
  expect(JSON.stringify(events)).not.toContain('dummy-');
  expect(toJSON).not.toHaveBeenCalled();
});

test('誤って非同期Extractorを渡されても拒否を回収して属性を省く', async () => {
  const { events, adapter } = recorder();
  const extractor: ContextExtractor = {
    // @ts-expect-error 非同期Extractorは公開契約では受け付けない
    start: () => Promise.reject(new Error('dummy-async')),
  };
  expect(
    await withLog('work', () => Promise.resolve(1), { adapter, extractor })(),
  ).toBe(1);
  await Promise.resolve();
  expect(events).toHaveLength(2);
  expect(events[0]).not.toHaveProperty('attributes');
});

test('キャッシュ済みProxyはunknownを絞り込むExtractorと初回設定を継承する', async () => {
  const { events, adapter } = recorder();
  const raw = {
    run(value: string) {
      return Promise.resolve(value.length);
    },
  };
  const proxy = createLoggingProxy(raw, {
    name: 'fixture',
    asyncMethods: ['run'],
    adapter,
    extractor: {
      start: (args) => ({
        size: typeof args[0] === 'string' ? args[0].length : 0,
      }),
      success: (result) => ({ count: typeof result === 'number' ? result : 0 }),
    },
  });
  expect(createLoggingProxy(raw, { name: 'ignored', asyncMethods: [] })).toBe(
    proxy,
  );
  for (const runId of ['A', 'B'])
    await withRunContext({ runId }, () => proxy.run('dummy'));
  expect(events.map((event) => event.attributes)).toEqual([
    { size: 5 },
    { count: 5 },
    { size: 5 },
    { count: 5 },
  ]);
  expect(events[0]?.operationId).not.toBe(events[2]?.operationId);
  expect(events.map((event) => event.runId)).toEqual(['A', 'A', 'B', 'B']);
});

export function invalidExtractors() {
  withLog('typed', (value: number) => Promise.resolve(value.toString()), {
    extractor: {
      // @ts-expect-error 引数型は元関数から決まり変更できない
      start: (args: [string]) => ({ value: args[0] }),
      // @ts-expect-error 結果型は元関数のstringでありnumberではない
      success: (result: number) => ({ result }),
    },
  });
  // @ts-expect-error 属性は浅いプリミティブ値のみ
  const attributes: LogAttributes = { nested: {} };
  return attributes;
}

function pendingResult() {
  let complete: ((value: string) => void) | undefined;
  const promise = new Promise<string>((resolve) => {
    complete = resolve;
  });
  return {
    promise,
    resolve(value: string) {
      if (!complete) throw new Error('Promise executor has not initialized');
      complete(value);
    },
  };
}

test('ConsoleAdapterのJSONでもID・属性を維持し、生の秘密値を省く', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  try {
    const input = { secret: 'dummy-password' };
    await withRunContext({ runId: 'json-run' }, () =>
      withLog('work', (value: typeof input) => Promise.resolve(value), {
        category: 'batch',
        extractor: { success: () => ({ count: 1 }) },
      })(input),
    );
    const records = logRecords(info.mock.calls);
    expect(records).toHaveLength(2);
    expect(records[0]?.operationId).toEqual(expect.any(String));
    expect(records[1]?.operationId).toBe(records[0]?.operationId);
    expect(records[0]).not.toHaveProperty('attributes');
    expect(records[1]).toMatchObject({
      attributes: { count: 1 },
      runId: 'json-run',
      category: 'batch',
      phase: 'success',
      level: 'info',
      message: 'Operation succeeded',
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain('dummy-password');
  } finally {
    info.mockRestore();
  }
});
