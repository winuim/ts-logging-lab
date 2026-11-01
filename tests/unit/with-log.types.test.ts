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

// tscでだけ検証する不正呼び出し。実行してログや未処理の拒否を発生させない。
export function checkInvalidCalls(): void {
  const wrapped = withLog('typed', (name: string, count: number) =>
    Promise.resolve({ name, count }),
  );
  // @ts-expect-error 引数の型を変更できない
  void wrapped(1, 2);
  // @ts-expect-error 必須引数を省略できない
  void wrapped('name');
  // @ts-expect-error 同期関数を非同期関数として受け付けない
  withLog('sync', () => 42);
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
