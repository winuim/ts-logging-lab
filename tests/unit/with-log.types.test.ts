import { expectTypeOf, test } from 'vitest';

import type { LogOptions } from '../../src/index.js';
import { withLog } from '../../src/index.js';

test('必須・省略可能・可変長引数と戻り値を保持する', () => {
  const wrapped = withLog(
    'typed',
    (name: string, count?: number, ...flags: boolean[]) =>
      Promise.resolve({ name, count, flags }),
  );

  expectTypeOf(wrapped).parameters.toEqualTypeOf<
    [name: string, count?: number | undefined, ...flags: boolean[]]
  >();
  expectTypeOf(wrapped).returns.toEqualTypeOf<
    Promise<{ name: string; count: number | undefined; flags: boolean[] }>
  >();
});

test('明示されたthis型を保持する', () => {
  const wrapped = withLog('this', function (this: { value: number }) {
    return Promise.resolve(this.value);
  });

  expectTypeOf(wrapped).thisParameter.toEqualTypeOf<{ value: number }>();
  expectTypeOf(wrapped).returns.toEqualTypeOf<Promise<number>>();
});

test('同期関数のthis・引数・戻り値と属性抽出の型を保持する', () => {
  const wrapped = withLog(
    'sync',
    function (
      this: { prefix: string },
      name: string,
      count?: number,
      ...flags: boolean[]
    ) {
      return { name: this.prefix + name, count, flags };
    },
    {
      extractor: {
        start: (args) => {
          expectTypeOf(args).toEqualTypeOf<
            [name: string, count?: number | undefined, ...flags: boolean[]]
          >();
          return {};
        },
        success: (result) => {
          expectTypeOf(result).toEqualTypeOf<{
            name: string;
            count: number | undefined;
            flags: boolean[];
          }>();
          return {};
        },
      },
    },
  );
  expectTypeOf(wrapped).thisParameter.toEqualTypeOf<{ prefix: string }>();
  expectTypeOf(wrapped).parameters.toEqualTypeOf<
    [name: string, count?: number | undefined, ...flags: boolean[]]
  >();
  expectTypeOf(wrapped).returns.toEqualTypeOf<{
    name: string;
    count: number | undefined;
    flags: boolean[];
  }>();
  const syncVoid = (): void => undefined;
  expectTypeOf(withLog('void', syncVoid)).toEqualTypeOf<typeof syncVoid>();
  expectTypeOf(
    withLog('never', (): never => {
      throw new Error('unused');
    }),
  ).returns.toEqualTypeOf<never>();
});

test('値とPromiseを返し分ける関数の型を保持し、成功属性には解決値を渡す', () => {
  const wrapped = withLog(
    'mixed',
    (later: boolean): number | Promise<number> =>
      later ? Promise.resolve(42) : 42,
    {
      extractor: {
        success: (result) => {
          expectTypeOf(result).toEqualTypeOf<number>();
          return { result };
        },
      },
    },
  );
  expectTypeOf(wrapped).returns.toEqualTypeOf<number | Promise<number>>();
});

test('thenableの戻り値型は解決値を持つ標準Promiseになる', () => {
  const source: PromiseLike<number> = {
    then: (success, failure) => Promise.resolve(42).then(success, failure),
  };
  const wrapped = withLog('thenable', () => source, {
    extractor: {
      success: (value) => {
        expectTypeOf(value).toEqualTypeOf<number>();
        return { value };
      },
    },
  });
  expectTypeOf(wrapped).returns.toEqualTypeOf<Promise<number>>();
});

// tscでだけ検証する不正呼び出し。実行してログや未処理の拒否を発生させない。
export function checkInvalidCalls(): void {
  const wrapped = withLog('typed', (name: string, count: number) =>
    Promise.resolve({ name, count }),
  );
  // @ts-expect-error 引数の型を変更できない
  void wrapped(1, 2);
  // @ts-expect-error 必須引数を省略できない
  void wrapped('name');
  const sync = withLog('sync', (value: number) => value);
  // @ts-expect-error 同期関数の戻り値はPromiseではない
  const promise: Promise<number> = sync(42);
  void promise;
  withLog('sync', () => 42, {
    // @ts-expect-error 属性抽出の型で元関数の戻り値型を変更できない
    extractor: { success: (value: string) => ({ value }) },
  });
  const receiver = withLog('this', function (this: { value: number }) {
    return Promise.resolve(this.value);
  });
  // @ts-expect-error thisを省略できない
  void receiver();
  // @ts-expect-error thisの型を変更できない
  void receiver.call({ value: 'wrong' });
}

export function checkLogOptions(options: LogOptions): void {
  // @ts-expect-error 設定プロパティはreadonly
  options.category = 'changed';
  // @ts-expect-error フェーズの設定もreadonly
  if (options.levels) options.levels.start = 'debug';
  // @ts-expect-error 不正なレベルを受け付けない
  withLog('work', () => Promise.resolve(1), { levels: { start: 'trace' } });
  // @ts-expect-error 不正なフェーズを受け付けない
  withLog('work', () => Promise.resolve(1), { levels: { finish: 'debug' } });
}
