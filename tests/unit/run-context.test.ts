import { setImmediate } from 'node:timers/promises';
import { expect, expectTypeOf, test, vi } from 'vitest';
import {
  ConsoleAdapter,
  createEmitter,
  createLoggingProxy,
  withLog,
  withRunContext,
} from '../../src/index.js';
import type { LogEvent, RunContext } from '../../src/index.js';

function recorder() {
  const events: LogEvent[] = [];
  const adapter = {
    emit: (event: LogEvent) => {
      events.push(event);
    },
  };
  const emit = createEmitter(adapter);
  const mark = () => {
    emit({ operation: 'mark', phase: 'start' });
  };
  return { events, adapter, emit, mark };
}

test('同期戻り値・Promise自体・同期例外・拒否理由を保持する', async () => {
  const value = { value: 42 };
  const context = { runId: 'run-A' };
  expect(withRunContext(context, () => value)).toBe(value);
  const promise = Promise.resolve(value);
  expect(withRunContext(context, () => promise)).toBe(promise);
  const reason = new Error('dummy-secret');
  let caught: unknown;
  try {
    withRunContext(context, () => {
      throw reason;
    });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(reason);
  const rejected = Promise.reject(reason);
  expect(withRunContext(context, () => rejected)).toBe(rejected);
  await expect(rejected).rejects.toBe(reason);
  expectTypeOf(withRunContext(context, () => 42)).toEqualTypeOf<number>();
  expectTypeOf(withRunContext(context, () => promise)).toEqualTypeOf<
    Promise<typeof value>
  >();
});

test('awaitと入れ子の非同期関数をまたいで保持し、文脈外には漏らさない', async () => {
  const { events, mark } = recorder();
  mark();
  await withRunContext({ runId: 'run-A' }, async () => {
    mark();
    await setImmediate();
    await (async () => {
      await setImmediate();
      mark();
    })();
    mark();
  });
  mark();
  expect(events.map((event) => event.runId)).toEqual([
    undefined,
    'run-A',
    'run-A',
    'run-A',
    undefined,
  ]);
  for (const event of [events.at(0), events.at(-1)]) {
    expect(event).not.toHaveProperty('runId');
  }
});

test.each(['success', 'throw', 'reject'] as const)(
  '入れ子の%s後に外側を復元する',
  async (mode) => {
    const { events, mark } = recorder();
    const reason = new Error('dummy-reason');
    await withRunContext({ runId: 'outer' }, async () => {
      mark();
      if (mode === 'throw') {
        expect(() =>
          withRunContext({ runId: 'inner' }, () => {
            mark();
            throw reason;
          }),
        ).toThrow(reason);
      } else {
        const inner = withRunContext({ runId: 'inner' }, async () => {
          await setImmediate();
          mark();
          if (mode === 'reject') throw reason;
          return 42;
        });
        // run()が戻った直後も、呼び出し元は外側の文脈。
        mark();
        if (mode === 'reject') await expect(inner).rejects.toBe(reason);
        else expect(await inner).toBe(42);
      }
      mark();
    });
    mark();
    expect(events.filter((event) => event.runId === 'inner')).toHaveLength(1);
    expect(events.at(-2)?.runId).toBe('outer');
    expect(events.at(-1)).not.toHaveProperty('runId');
    expect(events.filter((event) => event.runId === 'outer')).toHaveLength(
      mode === 'throw' ? 2 : 3,
    );
  },
);

test('同じ事前生成ラッパーを交互に進めても成功・失敗の文脈が混ざらない', async () => {
  const { events, adapter, mark } = recorder();
  function gate() {
    let resolve = () => {};
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }
  const gateA = gate();
  const gateB = gate();
  const reason = new Error('dummy-secret');
  const work = withLog(
    'work',
    async (gate: Promise<void>, fail: boolean) => {
      await gate;
      mark();
      await setImmediate();
      if (fail) throw reason;
      return 42;
    },
    {
      adapter,
      category: 'batch',
      levels: { start: 'debug', success: 'debug' },
    },
  );
  const a = withRunContext({ runId: 'run-A' }, () =>
    work(gateA.promise, false),
  );
  const b = withRunContext({ runId: 'run-B' }, () => work(gateB.promise, true));
  const rejected = expect(b).rejects.toBe(reason);
  gateB.resolve();
  await rejected;
  gateA.resolve();
  expect(await a).toBe(42);
  expect(
    events.map((event) => [event.operation, event.phase, event.runId]),
  ).toEqual([
    ['work', 'start', 'run-A'],
    ['work', 'start', 'run-B'],
    ['mark', 'start', 'run-B'],
    ['work', 'failure', 'run-B'],
    ['mark', 'start', 'run-A'],
    ['work', 'success', 'run-A'],
  ]);
  expect(
    events
      .filter((event) => event.operation === 'work')
      .map((event) => [event.category, event.level]),
  ).toEqual([
    ['batch', 'debug'],
    ['batch', 'debug'],
    ['batch', 'error'],
    ['batch', 'debug'],
  ]);
});

test('文脈はrunIdだけをコピーし、変更・余分な属性・toJSONを持ち込まない', async () => {
  const { events, emit } = recorder();
  const toJSON = vi.fn(() => 'dummy-secret');
  const context = {
    runId: 'original',
    args: ['dummy-password'],
    error: 'dummy-cookie',
    toJSON,
  };
  const input = {
    operation: 'work',
    phase: 'start' as const,
    runId: 'forged',
    result: 'dummy-token',
    toJSON,
  };
  await withRunContext(context, async () => {
    context.runId = 'changed';
    await setImmediate();
    emit(input);
  });
  expect(events).toEqual([
    {
      operation: 'work',
      phase: 'start',
      runId: 'original',
      level: 'info',
      message: 'Operation started',
    },
  ]);
  expect(JSON.stringify(events)).not.toContain('dummy-');
  expect(toJSON).not.toHaveBeenCalled();
  expect(input.runId).toBe('forged');
});

test('ConsoleAdapterもrunIdを出力し、空文字のIDも保持する', () => {
  const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  try {
    const emit = createEmitter(new ConsoleAdapter());
    withRunContext({ runId: '' }, () => {
      emit({ operation: 'work', phase: 'start' });
    });
    expect(output).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        operation: 'work',
        phase: 'start',
        runId: '',
        level: 'info',
        message: 'Operation started',
      }),
    );
  } finally {
    output.mockRestore();
  }
});

test.each(['throw', 'reject'] as const)(
  '出力の%sを隔離しthis・引数・結果・拒否理由を保持する',
  async (mode) => {
    const { events } = recorder();
    const input = { value: 42 };
    const receiver = { value: input };
    const reason = new Error('dummy-token');
    const work = withLog(
      'work',
      function (this: typeof receiver, arg: typeof input, fail: boolean) {
        expect(this).toBe(receiver);
        expect(arg).toBe(input);
        return fail ? Promise.reject(reason) : Promise.resolve(this.value);
      },
      {
        adapter: {
          emit(event) {
            events.push(event);
            if (mode === 'throw') throw new Error('output');
            return Promise.reject(new Error('output'));
          },
        },
      },
    );
    await withRunContext({ runId: 'run-A' }, async () => {
      expect(await work.call(receiver, input, false)).toBe(input);
      await expect(work.call(receiver, input, true)).rejects.toBe(reason);
    });
    await setImmediate();
    expect(events.map((event) => [event.phase, event.runId])).toEqual([
      ['start', 'run-A'],
      ['success', 'run-A'],
      ['start', 'run-A'],
      ['failure', 'run-A'],
    ]);
  },
);

test('キャッシュ済みProxyとメソッドは呼び出し時の文脈を使い初回設定を保つ', async () => {
  const { events, adapter } = recorder();
  const raw = { run: () => Promise.resolve(42) };
  const proxy = withRunContext({ runId: 'creation' }, () =>
    createLoggingProxy(raw, {
      name: 'work',
      asyncMethods: ['run'],
      adapter,
      category: 'batch',
    }),
  );
  const method = withRunContext({ runId: 'lookup' }, () => proxy.run);
  expect(
    createLoggingProxy(raw, {
      name: 'ignored',
      asyncMethods: [],
      category: 'ignored',
    }),
  ).toBe(proxy);
  expect(proxy.run).toBe(method);
  await Promise.all(
    ['run-A', 'run-B'].map((runId) =>
      withRunContext({ runId }, () => method()),
    ),
  );
  await method();
  expect(events.map((event) => event.runId)).toEqual([
    'run-A',
    'run-B',
    'run-A',
    'run-B',
    undefined,
    undefined,
  ]);
  expect(events.every((event) => event.category === 'batch')).toBe(true);
});

export function checkRunContext(context: RunContext): void {
  // @ts-expect-error 文脈はreadonly
  context.runId = 'changed';
  // @ts-expect-error runIdプロパティの省略は許可しない
  withRunContext({}, () => 42);
  // @ts-expect-error runIdに数値は指定できない
  withRunContext({ runId: 42 }, () => 42);
  // @ts-expect-error 任意属性の公開APIにしない
  withRunContext({ runId: 'run-A', secret: 'dummy' }, () => 42);
}
