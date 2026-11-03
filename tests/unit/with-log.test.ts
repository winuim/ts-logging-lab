import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  ConsoleAdapter,
  createEmitter,
  isPromiseLike,
  withLog,
} from '../../src/index.js';
import type { LogAdapter, LogEvent } from '../../src/index.js';
import { logRecords } from '../helpers/log-records.js';

describe('withLog', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  function records(): LogEvent[] {
    return logRecords([
      ...vi.mocked(console.info).mock.calls,
      ...vi.mocked(console.error).mock.calls,
    ]);
  }

  test('thenableの完了を待って解決値を属性抽出へ渡す', async () => {
    const source: PromiseLike<number> = {
      then: (success, failure) => Promise.resolve(42).then(success, failure),
    };
    const run = withLog('thenable', () => source, {
      extractor: { success: (value) => ({ value }) },
    });
    const result = run();
    expect(result).toBeInstanceOf(Promise);
    expect(records().map((event) => event.phase)).toEqual(['start']);
    expect(await result).toBe(42);
    expect(records().map((event) => event.phase)).toEqual(['start', 'success']);
    expect(records()[1]?.attributes).toEqual({ value: 42 });
  });

  test('別realmのPromiseの成功・失敗を完了時に記録する', async () => {
    const success: unknown = runInNewContext('Promise.resolve(42)');
    const failure: unknown = runInNewContext('Promise.reject("original")');
    if (!isPromiseLike(success) || !isPromiseLike(failure)) {
      throw new Error('Expected foreign promises');
    }
    expect(await withLog('foreign-success', () => success)()).toBe(42);
    await expect(withLog('foreign-failure', () => failure)()).rejects.toBe(
      'original',
    );
    expect(records().map((event) => event.phase)).toEqual([
      'start',
      'success',
      'start',
      'failure',
    ]);
  });

  test('thenのgetterの例外は同期throwとしてfailureを記録する', () => {
    const reason = new Error('getter');
    const run = withLog('getter', () => ({
      get then() {
        throw reason;
      },
    }));
    expect(run).toThrow(reason);
    expect(records().map((event) => event.phase)).toEqual(['start', 'failure']);
  });

  test('開始と成功を通知し、引数と戻り値を変更しない', async () => {
    const input = { secret: 'dummy-secret' };
    const result = { value: 42, secret: 'dummy-result' };
    const fn = vi.fn((v: typeof input, count: number) => {
      expect(v).toBe(input);
      expect(count).toBe(2);
      return Promise.resolve(result);
    });
    const run = withLog('work', fn);
    expect(await run(input, 2)).toBe(result);
    expect(fn).toHaveBeenCalledExactlyOnceWith(input, 2);
    expect(input).toEqual({ secret: 'dummy-secret' });
    expect(records().map((r) => r.phase)).toEqual(['start', 'success']);
    expect(records()[1]?.level).toBe('info');
    expect(records()[1]?.durationMs).toEqual(expect.any(Number));
    expect(JSON.stringify(records())).not.toContain('dummy-secret');
    expect(JSON.stringify(records())).not.toContain('dummy-result');
  });

  test('拒否理由をそのまま伝え、秘密の例外メッセージを記録しない', async () => {
    const error = new Error('dummy-token');
    const run = withLog('fail', () => Promise.reject(error));
    await expect(run()).rejects.toBe(error);
    expect(records().map((r) => r.phase)).toEqual(['start', 'failure']);
    expect(records()[1]?.level).toBe('error');
    expect(JSON.stringify(records())).not.toContain('dummy-token');
  });

  test('thisと引数を保持する', async () => {
    const run = withLog(
      'add',
      function (this: { base: number }, value: number) {
        return Promise.resolve(this.base + value);
      },
    );
    expect(await run.call({ base: 5 }, 7)).toBe(12);
  });

  test('同期throwは元の例外をその場でthrowする', () => {
    const reason = new Error('dummy-private');
    const run = withLog('throw', (): Promise<never> => {
      throw reason;
    });
    expect(run).toThrow(reason);
    expect(records().map((r) => r.phase)).toEqual(['start', 'failure']);
  });

  test('同期関数のthis・引数・戻り値と完了時のログを保持する', () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(14);
    const input = { secret: 'dummy-secret' };
    const result = { value: 42, secret: 'dummy-result' };
    const receiver = { base: 40 };
    const fn = vi.fn(function (
      this: typeof receiver,
      value: typeof input,
      count: number,
    ) {
      expect(this).toBe(receiver);
      expect(value).toBe(input);
      expect(this.base + count).toBe(result.value);
      expect(records().map((event) => event.phase)).toEqual(['start']);
      return result;
    });
    const run = withLog('sync', fn, {
      extractor: {
        start: ([, count]) => ({ count }),
        success: (value) => ({ value: value.value }),
      },
    });

    expect(run.call(receiver, input, 2)).toBe(result);
    expect(fn).toHaveBeenCalledExactlyOnceWith(input, 2);
    expect(records().map((event) => event.phase)).toEqual(['start', 'success']);
    expect(records()[0]?.attributes).toEqual({ count: 2 });
    expect(records()[1]?.attributes).toEqual({ value: 42 });
    expect(records()[1]?.durationMs).toBe(4);
    expect(records()[1]?.operationId).toBe(records()[0]?.operationId);
    expect(JSON.stringify(records())).not.toContain('dummy-');
  });

  test('同期void関数はundefinedをその場で返す', () => {
    const run = withLog('void', (): void => undefined);
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- void関数がPromiseで包まれないことを検証する。
    const result = run();
    expect(result).toBeUndefined();
    expect(records().map((event) => event.phase)).toEqual(['start', 'success']);
  });

  test.each([undefined, 'dummy-token', { secret: 'dummy-cookie' }])(
    '同期throwの値を変更せずfailure属性へ渡す: %s',
    (reason) => {
      const failure = vi.fn(() => ({ failed: true }));
      const run = withLog(
        'sync-fail',
        () => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error -- 任意のthrow値を保持する契約を検証する。
          throw reason;
        },
        { extractor: { failure } },
      );
      let caught = false;
      try {
        run();
      } catch (error) {
        caught = true;
        expect(error).toBe(reason);
      }
      expect(caught).toBe(true);
      expect(failure).toHaveBeenCalledExactlyOnceWith(reason);
      expect(records().map((event) => event.phase)).toEqual([
        'start',
        'failure',
      ]);
      expect(records()[1]?.attributes).toEqual({ failed: true });
      expect(JSON.stringify(records())).not.toContain('dummy-');
    },
  );

  test('同期処理でもAdapterの障害や完了待ちが本体へ影響しない', () => {
    const reason = new Error('original');
    const adapters: LogAdapter[] = [
      {
        emit() {
          throw new Error('adapter');
        },
      },
      { emit: () => Promise.reject(new Error('adapter')) },
      { emit: () => new Promise<void>(() => undefined) },
    ];
    for (const adapter of adapters) {
      expect(withLog('sync', () => 42, { adapter })()).toBe(42);
      expect(
        withLog(
          'sync-fail',
          () => {
            throw reason;
          },
          { adapter },
        ),
      ).toThrow(reason);
    }
  });

  test('値とPromiseを返し分ける関数は呼び出しごとの振る舞いを保つ', async () => {
    const run = withLog('mixed', (async: boolean): number | Promise<number> =>
      async ? Promise.resolve(42) : 42,
    );
    expect(run(false)).toBe(42);
    const pending = run(true);
    expect(pending).toBeInstanceOf(Promise);
    expect(records().map((event) => event.phase)).toEqual([
      'start',
      'success',
      'start',
    ]);
    expect(await pending).toBe(42);
    expect(records().map((event) => event.phase)).toEqual([
      'start',
      'success',
      'start',
      'success',
    ]);
  });

  test('同期・非同期のAdapter障害が本体へ影響しない', async () => {
    const error = new Error('adapter broke');
    const original = new Error('original failure');
    const throwing: LogAdapter = {
      emit() {
        throw error;
      },
    };
    const rejecting: LogAdapter = {
      emit() {
        return Promise.reject(error);
      },
    };
    expect(
      await withLog('sync', () => Promise.resolve(42), { adapter: throwing })(),
    ).toBe(42);
    expect(
      await withLog('async', () => Promise.resolve(43), {
        adapter: rejecting,
      })(),
    ).toBe(43);
    await expect(
      withLog('fail', () => Promise.reject(original), { adapter: throwing })(),
    ).rejects.toBe(original);
    await expect(
      withLog('fail', () => Promise.reject(original), { adapter: rejecting })(),
    ).rejects.toBe(original);
  });

  test('Adapterの完了を待たずに本体の結果を返す', async () => {
    const events: LogEvent[] = [];
    const adapter: LogAdapter = {
      emit(event) {
        if (event.kind === 'diagnostic')
          throw new Error('Unexpected diagnostic');
        events.push(event);
        return new Promise<void>(() => undefined);
      },
    };
    const result = { value: 42 };
    expect(
      await withLog('pending-output', () => Promise.resolve(result), {
        adapter,
      })(),
    ).toBe(result);
    expect(events.map((event) => event.phase)).toEqual(['start', 'success']);
  });

  test('記録用Adapterを差し替えられる', async () => {
    const events: LogEvent[] = [];
    const adapter: LogAdapter = {
      emit(event) {
        if (event.kind === 'diagnostic')
          throw new Error('Unexpected diagnostic');
        events.push(event);
      },
    };
    await withLog('custom', () => Promise.resolve(1), { adapter })();
    expect(events.map((event) => event.phase)).toEqual(['start', 'success']);
    expect(console.info).not.toHaveBeenCalled();
  });

  test('イベント生成と出力を分離する', () => {
    const events: LogEvent[] = [];
    const emit = createEmitter({
      emit(event) {
        if (event.kind === 'diagnostic')
          throw new Error('Unexpected diagnostic');
        events.push(event);
      },
    });
    emit({ operation: 'page.goto', phase: 'start' });
    emit({ operation: 'page.goto', phase: 'success', durationMs: 12.5 });
    expect(events).toEqual([
      {
        operation: 'page.goto',
        phase: 'start',
        level: 'info',
        message: 'Operation started',
      },
      {
        operation: 'page.goto',
        phase: 'success',
        durationMs: 12.5,
        level: 'info',
        message: 'Operation succeeded',
      },
    ]);
  });

  test.each([
    ['debug', 'debug'],
    ['info', 'info'],
    ['warning', 'warn'],
    ['error', 'error'],
  ] as const)(
    'ConsoleAdapterは%sをconsole.%sにNDJSON出力する',
    (level, method) => {
      const event: LogEvent = {
        operation: 'x',
        phase: 'start',
        level,
        message: 'Operation started',
      };
      new ConsoleAdapter().emit(event);
      expect(vi.spyOn(console, method).mock.calls).toEqual([
        [JSON.stringify(event)],
      ]);
      const calls = [
        vi.mocked(console.debug).mock.calls,
        vi.mocked(console.info).mock.calls,
        vi.mocked(console.warn).mock.calls,
        vi.mocked(console.error).mock.calls,
      ];
      expect(calls.reduce((count, entries) => count + entries.length, 0)).toBe(
        1,
      );
    },
  );

  test('並列実行の時間計測を混同しない', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(12)
      .mockReturnValueOnce(17)
      .mockReturnValueOnce(25);
    const first = pendingResult();
    const second = pendingResult();
    const run = withLog('parallel', (task: Promise<string>) => task);
    const a = run(first.promise);
    const b = run(second.promise);
    expect(records().map((r) => r.phase)).toEqual(['start', 'start']);
    second.resolve('second');
    expect(await b).toBe('second');
    first.resolve('first');
    expect(await a).toBe('first');
    expect(records().map((r) => r.phase)).toEqual([
      'start',
      'start',
      'success',
      'success',
    ]);
    expect(records().map((r) => r.durationMs)).toEqual([
      undefined,
      undefined,
      5,
      15,
    ]);
  });
});

// Error以外の拒否理由もコピーや正規化をせず伝える。
test.each(['dummy-token', undefined, { secret: 'dummy-cookie' }])(
  'Error以外の拒否理由も保持する: %s',
  async (reason) => {
    const events: LogEvent[] = [];
    const adapter: LogAdapter = {
      emit: (event) => {
        if (event.kind === 'diagnostic')
          throw new Error('Unexpected diagnostic');
        events.push(event);
      },
    };
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(24);
    try {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- 任意の拒否理由を保持する契約を検証する。
      const run = withLog('reject', () => Promise.reject(reason), { adapter });
      await expect(run()).rejects.toBe(reason);
      expect(events[0]?.operationId).toEqual(expect.any(String));
      expect(events).toEqual([
        {
          operation: 'reject',
          operationId: events[0]?.operationId,
          phase: 'start',
          level: 'info',
          message: 'Operation started',
        },
        {
          operation: 'reject',
          operationId: events[0]?.operationId,
          phase: 'failure',
          durationMs: 4,
          level: 'error',
          message: 'Operation failed',
        },
      ]);
    } finally {
      vi.restoreAllMocks();
    }
  },
);

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
