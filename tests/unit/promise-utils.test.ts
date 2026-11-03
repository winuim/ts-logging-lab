import { runInNewContext } from 'node:vm';
import { expect, expectTypeOf, test, vi } from 'vitest';
import { isPromiseLike, observePromise } from '../../src/index.js';

test('isPromiseLikeはPromise・別realm・関数のthenableを判定する', () => {
  const foreign: unknown = runInNewContext('Promise.resolve(42)');
  const callable = Object.assign(() => undefined, { then() {} });
  for (const value of [Promise.resolve(1), foreign, callable, { then() {} }]) {
    expect(isPromiseLike(value)).toBe(true);
    if (isPromiseLike(value)) {
      expectTypeOf(value).toExtend<PromiseLike<unknown>>();
    }
  }
  for (const value of [
    null,
    undefined,
    42,
    'value',
    true,
    Symbol(),
    {},
    { then: 1 },
    () => undefined,
  ]) {
    expect(isPromiseLike(value)).toBe(false);
  }
});

test('isPromiseLikeはthenを実行せず、getterの例外はそのまま伝える', () => {
  const then = vi.fn();
  expect(isPromiseLike({ then })).toBe(true);
  expect(then).not.toHaveBeenCalled();
  const reason = new Error('getter');
  expect(() =>
    isPromiseLike({
      get then() {
        throw reason;
      },
    }),
  ).toThrow(reason);
});

test('observePromiseはthenableを同化し、解決値の同一性を保って一度通知する', async () => {
  const value = { count: 42 };
  const source: PromiseLike<typeof value> = {
    then: (success, failure) => Promise.resolve(value).then(success, failure),
  };
  const success = vi.fn();
  const failure = vi.fn();
  const observed = observePromise(source, { success, failure });
  expectTypeOf(observed).toEqualTypeOf<Promise<typeof value>>();
  expect(observed).toBeInstanceOf(Promise);
  expect(success).not.toHaveBeenCalled();
  expect(await observed).toBe(value);
  expect(success).toHaveBeenCalledExactlyOnceWith(value);
  expect(failure).not.toHaveBeenCalled();
});

test.each([new Error('original'), undefined, 'reason', { code: 1 }])(
  'observePromiseは拒否理由を保持して失敗だけを通知する: %s',
  async (reason) => {
    const success = vi.fn();
    const failure = vi.fn();
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- 任意の拒否理由の保持を検証する。
    const observed = observePromise(Promise.reject(reason), {
      success,
      failure,
    });
    await expect(observed).rejects.toBe(reason);
    expect(failure).toHaveBeenCalledExactlyOnceWith(reason);
    expect(success).not.toHaveBeenCalled();
  },
);

test('observePromiseはthenのgetterがthrowしてもrejectとして観測する', async () => {
  const reason = new Error('getter');
  const failure = vi.fn();
  const source: PromiseLike<number> = {
    get then(): PromiseLike<number>['then'] {
      throw reason;
    },
  };
  await expect(observePromise(source, { failure })).rejects.toBe(reason);
  expect(failure).toHaveBeenCalledExactlyOnceWith(reason);
});

test('observePromiseは観測側のthrow・rejectを隔離し、完了を待たない', async () => {
  const callbacks = [
    () => {
      throw new Error('observer');
    },
    () => Promise.reject(new Error('observer')),
    () => new Promise<void>(() => undefined),
  ];
  const reason = new Error('original');
  for (const callback of callbacks) {
    expect(
      await observePromise(Promise.resolve(42), { success: callback }),
    ).toBe(42);
    await expect(
      observePromise(Promise.reject(reason), { failure: callback }),
    ).rejects.toBe(reason);
  }
  expect(await observePromise(Promise.resolve(42), {})).toBe(42);
  await expect(observePromise(Promise.reject(reason), {})).rejects.toBe(reason);
});
