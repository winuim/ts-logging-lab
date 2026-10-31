import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ConsoleAdapter, createEmitter, withLog } from '../../src/index.js';
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

  test('同期throwも元の拒否理由でrejectする', async () => {
    const reason = new Error('dummy-private');
    const run = withLog('throw', (): Promise<never> => {
      throw reason;
    });
    await expect(run()).rejects.toBe(reason);
    expect(records().map((r) => r.phase)).toEqual(['start', 'failure']);
  });

  test('同期・非同期のAdapter障害が本体へ影響しない', async () => {
    const error = new Error('adapter broke');
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
      withLog('fail', () => Promise.reject(error), { adapter: throwing })(),
    ).rejects.toBe(error);
    await expect(
      withLog('fail', () => Promise.reject(error), { adapter: rejecting })(),
    ).rejects.toBe(error);
  });

  test('記録用Adapterを差し替えられる', async () => {
    const events: LogEvent[] = [];
    const adapter: LogAdapter = {
      emit(event) {
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
      expect(events).toEqual([
        {
          operation: 'reject',
          phase: 'start',
          level: 'info',
          message: 'Operation started',
        },
        {
          operation: 'reject',
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
