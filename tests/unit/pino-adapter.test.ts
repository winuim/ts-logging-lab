import pino from 'pino';
import type { LoggerOptions } from 'pino';
import { afterEach, expect, test, vi } from 'vitest';
import {
  ConsoleAdapter,
  PinoAdapter,
  createEmitter,
  withLog,
  withRunContext,
} from '../../src/index.js';
import type { LogAdapter, LogEvent, LogLevel } from '../../src/index.js';

const anyNumber: unknown = expect.any(Number);
const anyString: unknown = expect.any(String);

function capture(options: LoggerOptions = {}) {
  const lines: string[] = [];
  const logger = pino(
    { base: null, ...options },
    {
      write(line: string) {
        lines.push(line);
      },
    },
  );
  return {
    logger,
    adapter: new PinoAdapter(logger),
    lines,
    records: () => lines.map((line): unknown => JSON.parse(line)),
  };
}

afterEach(() => vi.restoreAllMocks());

test('4レベルをPino標準の数値levelへ変換し、標準キーを重複出力しない', () => {
  const output = capture({ level: 'debug' });
  const levels: LogLevel[] = ['debug', 'info', 'warning', 'error'];
  for (const level of levels) {
    output.adapter.emit({
      operation: 'save',
      phase: 'start',
      level,
      message: 'fixed',
    });
  }
  expect(output.records()).toEqual(
    [20, 30, 40, 50].map((level) => ({
      level,
      time: anyNumber,
      msg: 'fixed',
      operation: 'save',
      phase: 'start',
    })),
  );
  for (const line of output.lines) {
    for (const key of ['level', 'time', 'msg']) {
      expect(line.match(new RegExp(`"${key}":`, 'g'))).toHaveLength(1);
    }
    expect(line).not.toContain('"message":');
  }
});

test('Pinoのlevelが出力を抑制し、Emitterのレベル割り当ては維持する', () => {
  const output = capture({ level: 'warn' });
  const emit = createEmitter(output.adapter, {
    levels: { start: 'debug', success: 'warning' },
  });
  emit({ operation: 'save', phase: 'start' });
  emit({ operation: 'save', phase: 'success', durationMs: 1 });
  emit({ operation: 'save', phase: 'failure', durationMs: 2 });
  expect(output.records()).toEqual([
    {
      level: 40,
      time: anyNumber,
      msg: 'Operation succeeded',
      operation: 'save',
      phase: 'success',
      durationMs: 1,
    },
    {
      level: 50,
      time: anyNumber,
      msg: 'Operation failed',
      operation: 'save',
      phase: 'failure',
      durationMs: 2,
    },
  ]);
});

test('実出力でパスを秘匿し、非対象属性と入力イベントを維持する', () => {
  const output = capture({
    redact: {
      paths: ['attributes.email', 'attributes.token'],
      censor: '[REDACTED]',
    },
  });
  const attributes = Object.freeze({
    email: 'dummy-private@example.test',
    token: 'dummy-secret-token',
    userId: 'u1',
    level: 'nested',
    time: 123,
    msg: 'nested',
  });
  const event: LogEvent = Object.freeze({
    operation: 'save',
    phase: 'start',
    level: 'info',
    message: 'Operation started',
    attributes,
  });
  output.adapter.emit(event);
  expect(output.lines.join('')).not.toContain(attributes.email);
  expect(output.lines.join('')).not.toContain(attributes.token);
  expect(output.records()).toEqual([
    {
      level: 30,
      time: anyNumber,
      msg: 'Operation started',
      operation: 'save',
      phase: 'start',
      attributes: { ...attributes, email: '[REDACTED]', token: '[REDACTED]' },
    },
  ]);
  expect(event.attributes).toBe(attributes);
  expect(attributes.token).toBe('dummy-secret-token');
});

test('並列呼び出しのrunId・operationId・フェーズ・カテゴリ・属性を保持する', async () => {
  const output = capture();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const work = withLog(
    'save',
    async (userId: string) => {
      if (userId === 'a') await gate;
      return userId;
    },
    {
      adapter: output.adapter,
      category: 'users',
      extractor: {
        start: ([userId]) => ({ userId }),
        success: (userId) => ({ userId }),
      },
    },
  );
  await withRunContext({ runId: 'run-A' }, async () => {
    const a = work('a');
    await work('b');
    release();
    await a;
  });
  const records = output.records();
  expect(records).toHaveLength(4);
  for (const record of records)
    expect(record).toMatchObject({
      runId: 'run-A',
      operation: 'save',
      category: 'users',
      operationId: anyString,
    });
  expect(records[0]).toMatchObject({
    phase: 'start',
    attributes: { userId: 'a' },
  });
  expect(records[1]).toMatchObject({
    phase: 'start',
    attributes: { userId: 'b' },
  });
  expect(records[2]).toMatchObject({
    phase: 'success',
    durationMs: anyNumber,
    attributes: { userId: 'b' },
  });
  expect(records[3]).toMatchObject({
    phase: 'success',
    durationMs: anyNumber,
    attributes: { userId: 'a' },
  });
  function id(record: unknown) {
    if (
      typeof record !== 'object' ||
      record === null ||
      !('operationId' in record)
    )
      throw new Error('Missing operationId');
    return record.operationId;
  }
  expect(id(records[0])).toBe(id(records[3]));
  expect(id(records[1])).toBe(id(records[2]));
  expect(id(records[0])).not.toBe(id(records[1]));
});

test('同じ操作をConsole/Pinoで差し替え、this・引数・結果・拒否理由を保つ', async () => {
  const output = capture();
  const consoleInfo = vi
    .spyOn(console, 'info')
    .mockImplementation(() => undefined);
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const argument = { token: 'dummy-unselected-token' };
  const result = { ok: true };
  const reason = new Error('dummy-private-error');
  const receiver = { name: 'receiver' };
  for (const adapter of [new ConsoleAdapter(), output.adapter]) {
    const fn = vi.fn(function (this: typeof receiver, value: typeof argument) {
      expect(this).toBe(receiver);
      expect(value).toBe(argument);
      return Promise.resolve(result);
    });
    expect(
      await withLog('save', fn, { adapter }).call(receiver, argument),
    ).toBe(result);
    expect(fn).toHaveBeenCalledTimes(1);
    await expect(
      withLog('save', () => Promise.reject(reason), { adapter })(),
    ).rejects.toBe(reason);
  }
  expect(consoleInfo).toHaveBeenCalledTimes(3);
  expect(consoleError).toHaveBeenCalledTimes(1);
  expect(output.records()).toHaveLength(4);
  expect(output.lines.join('')).not.toContain(argument.token);
  expect(output.lines.join('')).not.toContain(reason.message);
  for (const record of output.records())
    expect(record).not.toHaveProperty('runId');
});

test('Pino出力の同期throwでも本体の成功・拒否理由を保持する', async () => {
  const write = vi.fn(() => {
    throw new Error('dummy-output-failure');
  });
  const adapter: LogAdapter = new PinoAdapter(pino({}, { write }));
  const result = {};
  const reason = new Error('dummy-body-failure');
  expect(
    await withLog('save', () => Promise.resolve(result), { adapter })(),
  ).toBe(result);
  await expect(
    withLog('save', () => Promise.reject(reason), { adapter })(),
  ).rejects.toBe(reason);
  expect(write).toHaveBeenCalledTimes(4);
});
