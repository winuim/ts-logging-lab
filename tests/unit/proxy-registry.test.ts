import { EventEmitter } from 'node:events';
import { afterEach, expect, expectTypeOf, test, vi } from 'vitest';
import {
  createLoggingProxy,
  unwrap,
  withPageLogging,
} from '../../src/index.js';

afterEach(() => vi.restoreAllMocks());

test('同じ実体とProxyの再ラップは同じProxyで、unwrapは実体へ戻す', () => {
  const raw = { goto: () => Promise.resolve(null) };
  const proxy = withPageLogging(raw);
  expect(withPageLogging(raw)).toBe(proxy);
  expect(withPageLogging(proxy)).toBe(proxy);
  expect(unwrap(proxy)).toBe(raw);
  expect(unwrap(raw)).toBe(raw);
  expect(unwrap(null)).toBeNull();
  expect(unwrap(42)).toBe(42);
  expectTypeOf(unwrap(proxy)).toEqualTypeOf<typeof raw>();
});

test('メソッド参照は安定し、元の関数を差し替えたら更新する', () => {
  const raw = { method: () => 1 };
  const proxy = createLoggingProxy(raw, { name: 'raw', asyncMethods: [] });
  expect(proxy.method).toBe(proxy.method);
  raw.method = () => 2;
  expect(proxy.method()).toBe(2);
});

test('Proxy引数を実体へ戻し、配列や入力オブジェクトは変更しない', () => {
  const raw = { value: 1 };
  const value = createLoggingProxy(raw, { name: 'value', asyncMethods: [] });
  const receiver = createLoggingProxy(
    { take: (input: typeof raw) => input === raw },
    { name: 'receiver', asyncMethods: [] },
  );
  expect(receiver.take(value)).toBe(true);
  expect(value.value).toBe(1);
});

test('イベントの同じhandlerで登録・解除でき、onのチェーンも保つ', () => {
  const raw = new EventEmitter();
  const proxy = createLoggingProxy(raw, { name: 'emitter', asyncMethods: [] });
  const handler = vi.fn();
  expect(proxy.on('event', handler)).toBe(proxy);
  raw.emit('event', 'first');
  proxy.off('event', handler);
  raw.emit('event', 'second');
  expect(handler).toHaveBeenCalledExactlyOnceWith('first');
  expect(raw.listenerCount('event')).toBe(0);
  expect(proxy.constructor).toBe(raw.constructor);
});

test('同じ実体では最初の設定を採用し、ログを重複させない', async () => {
  const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const raw = { goto: () => Promise.resolve(null) };
  const proxy = withPageLogging(withPageLogging(raw));
  expect(createLoggingProxy(raw, { name: 'other', asyncMethods: [] })).toBe(
    proxy,
  );
  await proxy.goto();
  expect(output).toHaveBeenCalledTimes(2);
});
