import { expect, expectTypeOf, test } from 'vitest';
import {
  navigationContext,
  safeUrlAttributes,
  safeSelectorAttributes,
  withLog,
  REDACTED,
} from '../../src/index.js';
import type { ContextExtractor, LogEvent } from '../../src/index.js';

test('before/afterを呼び、結果の型とphase属性を保つ', async () => {
  const events: LogEvent[] = [];
  const calls: string[] = [];
  const extractor: ContextExtractor<number> = {
    before(context) {
      calls.push('before');
      return { contextOperation: context.operation };
    },
    after(context) {
      calls.push('after');
      if (context.resultKind === 'primitive') {
        expectTypeOf(context.result).toEqualTypeOf<number>();
        return { count: context.result };
      }
      return {};
    },
    error() {
      calls.push('error');
      return {};
    },
  };
  expect(
    await withLog('count', () => Promise.resolve(3), {
      extractor,
      adapter: {
        emit(event) {
          events.push(event);
        },
      },
    })(),
  ).toBe(3);
  expect(calls).toEqual(['before', 'after']);
  expect(events[1]?.attributes['count']).toBe(3);
  expect(events[0]?.attributes['count']).toBeUndefined();
});

test('errorフック例外でも元の拒否理由を優先し、生の例外を渡さない', async () => {
  const error = new Error('dummy-secret');
  let failed: unknown;
  const events: LogEvent[] = [];
  const fn = withLog('fail', () => Promise.reject(error), {
    extractor: {
      error(context) {
        failed = context;
        throw new Error('extractor failure');
      },
    },
    adapter: {
      emit(event) {
        events.push(event);
      },
    },
  });
  await expect(fn()).rejects.toBe(error);
  expect(failed).toEqual({ operation: 'fail', args: [], failed: true });
  expect(JSON.stringify(events)).not.toContain('dummy-secret');
});

test('非primitiveの結果をフックへ渡さず、before例外でも本体を呼ぶ', async () => {
  const result = { secret: 'dummy-secret' };
  let visible: unknown;
  const wrapped = withLog('op', () => Promise.resolve(result), {
    extractor: {
      before() {
        throw new Error('before');
      },
      after(context) {
        visible = context;
        return {};
      },
    },
  });
  expect(await wrapped()).toBe(result);
  expect(visible).toEqual({
    operation: 'op',
    args: [],
    resultKind: 'opaque',
    result: undefined,
  });
});

test('誤ったasyncフックの拒否を処理し、Policyの秘匿属性を上書きしない', async () => {
  const events: LogEvent[] = [];
  const extractor: ContextExtractor<number> = {
    before: () => ({ arguments: 'dummy-secret' }),
    after: () => ({}),
  };
  Reflect.set(extractor, 'after', () =>
    Promise.reject(new Error('async hook')),
  );
  await withLog('op', () => Promise.resolve(1), {
    extractor,
    adapter: {
      emit(event) {
        events.push(event);
      },
    },
  })();
  expect(events[0]?.attributes['arguments']).toBe(REDACTED);
  expect(JSON.stringify(events)).not.toContain('dummy-secret');
});

test('許可originだけを返し、userinfo/path/query/fragmentを捨てる', async () => {
  const url =
    'https://user:dummy-secret@example.test/private?token=dummy-secret#secret';
  expect(
    navigationContext(['https://example.test']).before?.({
      operation: 'keyboard.type',
      args: [url],
    }),
  ).toEqual({});
  expect(safeUrlAttributes(url)).toEqual({ origin: REDACTED });
  expect(safeUrlAttributes(url, ['https://example.test'])).toEqual({
    origin: 'https://example.test',
  });
  expect(
    safeUrlAttributes('https://example.test@evil.test/path', [
      'https://example.test',
    ]),
  ).toEqual({ origin: REDACTED });
  expect(safeUrlAttributes('data:text/html,secret', ['null'])).toEqual({
    origin: REDACTED,
  });
  const events: LogEvent[] = [];
  await withLog('page.goto', (value: string) => Promise.resolve(value.length), {
    extractor: navigationContext(['https://example.test']),
    adapter: {
      emit(event) {
        events.push(event);
      },
    },
  })(url);
  expect(JSON.stringify(events)).not.toContain('dummy-secret');
  expect(events[0]?.attributes['origin']).toBe('https://example.test');
});

test('selectorは明示した公開名だけを残す', () => {
  expect(safeSelectorAttributes('#unknown')['selectorLabel']).toBe(REDACTED);
  expect(safeSelectorAttributes('#public', ['#public'])['selectorLabel']).toBe(
    '#public',
  );
  expect(
    safeSelectorAttributes('#password', ['#password'])['selectorLabel'],
  ).toBe(REDACTED);
});

test('実行時にasyncへ差し替わったPolicyの拒否も隔離する', async () => {
  const holder = { rule: () => ({}) };
  Reflect.set(holder, 'rule', () => Promise.reject(new Error('async policy')));
  expect(
    await withLog('op', () => Promise.resolve(1), {
      argumentPolicy: () => holder.rule(),
    })(),
  ).toBe(1);
});
