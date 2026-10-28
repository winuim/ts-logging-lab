import { expect, test } from 'vitest';
import {
  createArgumentPolicy,
  createPuppeteerPolicy,
  maskArguments,
  REDACTED,
  withLog,
} from '../../src/index.js';
import type { LogEvent } from '../../src/index.js';

test('未知操作・未知contextと複数入力は既定で伏せる', () => {
  const policy = createPuppeteerPolicy();
  for (const operation of [
    'unknown',
    'keyboard.type',
    'locator.fill',
    'page.type',
    'page.select',
  ]) {
    const attrs = maskArguments(policy, operation, [
      '#unknown',
      'dummy-secret-1',
      'dummy-secret-2',
    ]);
    expect(JSON.stringify(attrs)).not.toContain('dummy-secret');
    expect(JSON.stringify(attrs)).toContain(REDACTED);
  }
});

test('明示された公開selectorだけ許可し、秘密名はallowlistでも伏せる', () => {
  const policy = createPuppeteerPolicy(['#public', '#password']);
  expect(maskArguments(policy, 'page.type', ['#public', 'hello'])).toEqual({
    selector: '#public',
    input: 'hello',
  });
  expect(
    JSON.stringify(
      maskArguments(policy, 'page.type', ['#password', 'dummy-secret']),
    ),
  ).not.toContain('dummy-secret');
  expect(
    maskArguments(policy, 'page.select', ['#public', 'one', 'two'])['values'],
  ).toBe('["one","two"]');
});

test('非primitiveを読まず、元の引数を変更しない追加Policy', () => {
  const input = {
    secret: 'dummy-secret',
    get unsafe(): never {
      throw new Error('getter');
    },
  };
  const args = [input, 'dummy'];
  const policy = createArgumentPolicy({
    count: (values) => ({
      count: values.length,
      object: values[0] === REDACTED,
    }),
  });
  expect(maskArguments(policy, 'count', args)).toEqual({
    count: 2,
    object: true,
  });
  expect(args[0]).toBe(input);
  expect(input.secret).toBe('dummy-secret');
});

test('Policy例外・予約属性・無効な属性値を安全側へ倒す', () => {
  const throwing = createArgumentPolicy({
    op() {
      throw new Error('dummy-secret');
    },
  });
  expect(maskArguments(throwing, 'op', ['dummy-secret'])['arguments']).toBe(
    REDACTED,
  );
  const reserved = createArgumentPolicy({
    op: () => ({ traceId: 'dummy-secret' }),
  });
  expect(JSON.stringify(maskArguments(reserved, 'op', []))).not.toContain(
    'dummy-secret',
  );
  const invalid = createArgumentPolicy({ op: () => ({ value: Number.NaN }) });
  expect(maskArguments(invalid, 'op', [])['arguments']).toBe(REDACTED);
});

test('成功・失敗の全イベントで秘密を出さず、元の引数・例外を保つ', async () => {
  const events: LogEvent[] = [];
  const error = new Error('dummy-error-secret');
  const secret = 'dummy-input-secret';
  const success = withLog(
    'keyboard.type',
    (value: string) => Promise.resolve(value),
    {
      adapter: {
        emit(event) {
          events.push(event);
        },
      },
    },
  );
  expect(await success(secret)).toBe(secret);
  const failure = withLog('page.type', () => Promise.reject(error), {
    argumentPolicy: createArgumentPolicy({
      'page.type'() {
        throw new Error(secret);
      },
    }),
    adapter: {
      emit(event) {
        events.push(event);
      },
    },
  });
  await expect(failure()).rejects.toBe(error);
  expect(JSON.stringify(events)).not.toContain(secret);
  expect(JSON.stringify(events)).not.toContain('dummy-error-secret');
});
