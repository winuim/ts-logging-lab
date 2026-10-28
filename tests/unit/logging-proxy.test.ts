import { afterEach, expect, test, vi } from 'vitest';
import { createLoggingProxy } from '../../src/index.js';

afterEach(() => vi.restoreAllMocks());

test('同期・非同期のthis戻り値とprivateを保ち、単純値を変えない', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  class Counter {
    #value = 1;
    get value() {
      return this.#value;
    }
    next() {
      this.#value++;
      return this;
    }
    later() {
      return Promise.resolve(this);
    }
    read() {
      return this.#value;
    }
  }
  const raw = new Counter();
  const proxy = createLoggingProxy(raw, {
    name: 'counter',
    asyncMethods: ['later'],
  });
  expect(proxy.next()).toBe(proxy);
  expect(await proxy.later()).toBe(proxy);
  expect(proxy.value).toBe(2);
  expect(proxy.read()).toBe(2);
  expect(console.info).toHaveBeenCalledTimes(2);
});

test('戻り値選択は同期・Promise・getterに適用し、失敗時は元値へ戻す', async () => {
  const child = { value: 1 };
  const wrapped = { value: 1 };
  const raw = {
    child,
    getChild: () => child,
    later: () => Promise.resolve(child),
    scalar: () => null,
  };
  const proxy = createLoggingProxy(raw, {
    name: 'parent',
    asyncMethods: [],
    wrapResult: (value) => (value === child ? wrapped : value),
  });
  expect(proxy.child).toBe(wrapped);
  expect(proxy.getChild()).toBe(wrapped);
  expect(await proxy.later()).toBe(wrapped);
  expect(proxy.scalar()).toBeNull();
  const failed = createLoggingProxy(raw, {
    name: 'parent',
    asyncMethods: [],
    wrapResult() {
      throw new Error('mapper');
    },
  });
  expect(failed.child).toBe(child);
  expect(await failed.later()).toBe(child);
});

test('同期throw・拒否理由を保持する', async () => {
  const error = new Error('original');
  const raw = {
    fail(): never {
      throw error;
    },
    reject: () => Promise.reject(error),
  };
  const proxy = createLoggingProxy(raw, { name: 'test', asyncMethods: [] });
  let caught: unknown;
  try {
    proxy.fail();
  } catch (value) {
    caught = value;
  }
  expect(caught).toBe(error);
  await expect(proxy.reject()).rejects.toBe(error);
});
