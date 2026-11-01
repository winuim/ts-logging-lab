import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { withLog } from '../../src/index.js';

describe('withLog', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('元の引数・結果の同一性と呼び出し回数を保持する', async () => {
    const input = { secret: 'dummy-input' };
    const result = { value: 42 };
    const fn = vi.fn((value: typeof input, count: number) => {
      expect(value).toBe(input);
      expect(count).toBe(2);
      return Promise.resolve(result);
    });
    const wrapped = withLog('work', fn);

    expect(await wrapped(input, 2)).toBe(result);
    expect(fn).toHaveBeenCalledExactlyOnceWith(input, 2);
    expect(input).toEqual({ secret: 'dummy-input' });
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
      'dummy-input',
    );
  });

  test('完了を待ち、開始・成功・単調時計による処理時間を出力する', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(112.5);
    const pending = pendingResult();
    const wrapped = withLog('wait', () => pending.promise);

    const result = wrapped();
    expect(console.info).toHaveBeenCalledExactlyOnceWith('wait: start');
    pending.resolve('done');

    expect(await result).toBe('done');
    expect(console.info).toHaveBeenNthCalledWith(2, 'wait: success (12.50 ms)');
    expect(console.info).toHaveBeenCalledTimes(2);
  });

  test.each([new Error('dummy-secret'), 'dummy-token', undefined])(
    '拒否理由を変更せず、失敗と処理時間だけを出力する（%s）',
    async (reason) => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(20)
        .mockReturnValueOnce(24);
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Error以外の拒否理由もそのまま保持する契約を検証する。
      const wrapped = withLog('reject', () => Promise.reject(reason));

      await expect(wrapped()).rejects.toBe(reason);
      expect(console.info).toHaveBeenNthCalledWith(1, 'reject: start');
      expect(console.info).toHaveBeenNthCalledWith(
        2,
        'reject: failure (4.00 ms)',
      );
      expect(console.info).toHaveBeenCalledTimes(2);
    },
  );

  test('Promiseを返す関数の同期throwも同じ理由でrejectする', async () => {
    const error = new Error('dummy-secret');
    const wrapped = withLog('sync-throw', (): Promise<never> => {
      throw error;
    });

    let result: Promise<never> | undefined;
    expect(() => {
      result = wrapped();
    }).not.toThrow();
    await expect(result).rejects.toBe(error);
    expect(console.info).toHaveBeenLastCalledWith(
      expect.stringMatching(/^sync-throw: failure \(\d+\.\d{2} ms\)$/),
    );
  });

  test('呼び出し側のthisを保持する', async () => {
    const receiver = {
      base: 10,
      add: withLog('add', function (this: { base: number }, amount: number) {
        return Promise.resolve(this.base + amount);
      }),
    };

    expect(await receiver.add(2)).toBe(12);
    expect(await receiver.add.call({ base: 20 }, 3)).toBe(23);
  });

  test('ログ出力が常に失敗しても本体の結果・拒否理由を保持する', async () => {
    vi.mocked(console.info).mockImplementation(() => {
      throw new Error('output unavailable');
    });
    const result = { ok: true };
    const error = new Error('original');
    const success = withLog('success', () => Promise.resolve(result));
    const failure = withLog('failure', () => Promise.reject(error));

    expect(await success()).toBe(result);
    await expect(failure()).rejects.toBe(error);
    expect(console.info).toHaveBeenCalledTimes(4);
  });

  test('並行呼び出しの時間計測を混同せず、生の引数と結果をログに出さない', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(12)
      .mockReturnValueOnce(17)
      .mockReturnValueOnce(25);
    const first = pendingResult();
    const second = pendingResult();
    const wrapped = withLog('parallel', (value: Promise<string>) => value);
    const a = wrapped(first.promise);
    const b = wrapped(second.promise);
    second.resolve('dummy-result-2');
    expect(await b).toBe('dummy-result-2');
    first.resolve('dummy-result-1');
    expect(await a).toBe('dummy-result-1');

    expect(vi.mocked(console.info).mock.calls).toEqual([
      ['parallel: start'],
      ['parallel: start'],
      ['parallel: success (5.00 ms)'],
      ['parallel: success (15.00 ms)'],
    ]);
  });
});

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
