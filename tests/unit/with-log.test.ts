import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ConsoleAdapter, createEmitter, withLog } from '../../src/index.js';
import type { LogAdapter, LogEvent } from '../../src/index.js';

describe('withLog', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  function records(): LogEvent[] {
    return [...vi.mocked(console.info).mock.calls, ...vi.mocked(console.error).mock.calls]
      .map(([value]) => JSON.parse(value as string) as LogEvent);
  }

  test('開始と成功を通知し、引数と戻り値を変更しない', async () => {
    const input = { secret: 'dummy-secret' };
    const result = { value: 42 };
    const fn = vi.fn(async (v: typeof input) => {
      expect(v).toBe(input);
      return result;
    });
    const run = withLog('work', fn);
    expect(await run(input)).toBe(result);
    expect(fn).toHaveBeenCalledExactlyOnceWith(input);
    expect(records().map((r) => r.phase)).toEqual(['start', 'success']);
    expect(records()[1]?.level).toBe('info');
    expect(records()[1]?.durationMs).toEqual(expect.any(Number));
    expect(JSON.stringify(records())).not.toContain('dummy-secret');
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
    const run = withLog('add', function (this: { base: number }, value: number) {
      return Promise.resolve(this.base + value);
    });
    expect(await run.call({ base: 5 }, 7)).toBe(12);
  });

  test('同期throwも元の拒否理由でrejectする', async () => {
    const reason = { reason: 'private' };
    const run = withLog('throw', (): Promise<never> => { throw reason; });
    await expect(run()).rejects.toBe(reason);
    expect(records().map((r) => r.phase)).toEqual(['start', 'failure']);
  });

  test('同期・非同期のAdapter障害が本体へ影響しない', async () => {
    const error = new Error('adapter broke');
    const throwing: LogAdapter = { emit() { throw error; } };
    const rejecting: LogAdapter = { emit() { return Promise.reject(error); } };
    expect(await withLog('sync', async () => 42, { adapter: throwing })()).toBe(42);
    expect(await withLog('async', async () => 43, { adapter: rejecting })()).toBe(43);
    await expect(withLog('fail', () => Promise.reject(error), { adapter: throwing })()).rejects.toBe(error);
  });

  test('記録用Adapterを差し替えられる', async () => {
    const events: LogEvent[] = [];
    const adapter: LogAdapter = { emit(event) { events.push(event); } };
    await withLog('custom', async () => 1, { adapter })();
    expect(events.map((event) => event.phase)).toEqual(['start', 'success']);
    expect(console.info).not.toHaveBeenCalled();
  });

  test('イベント生成と出力を分離する', () => {
    const events: LogEvent[] = [];
    const emit = createEmitter({ emit(event) { events.push(event); } });
    emit({ operation: 'page.goto', phase: 'start' });
    emit({ operation: 'page.goto', phase: 'success', durationMs: 12.5 });
    expect(events).toEqual([
      { operation: 'page.goto', phase: 'start', level: 'info', message: 'Operation started' },
      { operation: 'page.goto', phase: 'success', durationMs: 12.5, level: 'info', message: 'Operation succeeded' },
    ]);
  });

  test.each([
    ['debug', 'debug'],
    ['info', 'info'],
    ['warning', 'warn'],
    ['error', 'error'],
  ] as const)('ConsoleAdapterは%sをconsole.%sにNDJSON出力する', (level, method) => {
    const event: LogEvent = { operation: 'x', phase: 'start', level, message: 'Operation started' };
    new ConsoleAdapter().emit(event);
    expect(console[method]).toHaveBeenCalledExactlyOnceWith(JSON.stringify(event));
    const total = ['debug', 'info', 'warn', 'error'] as const;
    expect(total.reduce((count, name) => count + vi.mocked(console[name]).mock.calls.length, 0)).toBe(1);
  });

  test('並列実行の時間計測を混同しない', async () => {
    let resolveFirst!: (value: string) => void;
    let resolveSecond!: (value: string) => void;
    const first = new Promise<string>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<string>((resolve) => { resolveSecond = resolve; });
    const run = withLog('parallel', (task: Promise<string>) => task);
    const a = run(first);
    const b = run(second);
    resolveSecond('second');
    expect(await b).toBe('second');
    resolveFirst('first');
    expect(await a).toBe('first');
    expect(records().map((r) => r.phase)).toEqual(['start', 'start', 'success', 'success']);
  });
});
