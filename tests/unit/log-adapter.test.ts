import { configureSync } from '@logtape/logtape';
import type { LogRecord } from '@logtape/logtape';
import { expect, test } from 'vitest';
import { LogTapeAdapter, withLog } from '../../src/index.js';
import type { LogAdapter, LogEvent } from '../../src/index.js';

test('記録用ダブルへ構造化イベントを生成し、本体の値を保つ', async () => {
  const events: LogEvent[] = [];
  const adapter: LogAdapter = {
    emit(event) {
      events.push(event);
    },
  };
  const result = { ok: true };
  expect(
    await withLog('op', () => Promise.resolve(result), { adapter })(),
  ).toBe(result);
  expect(events.map((event) => event.phase)).toEqual(['start', 'success']);
  expect(events[1]?.attributes['durationMs']).toBeTypeOf('number');
  expect(events[0]?.level).toBe('info');
});

test('Adapterの同期throw・非同期rejectを隔離する', async () => {
  const error = new Error('original');
  const adapters: LogAdapter[] = [
    {
      emit() {
        throw new Error('sink');
      },
    },
    {
      emit() {
        return Promise.reject(new Error('async sink'));
      },
    },
  ];
  for (const adapter of adapters) {
    expect(await withLog('ok', () => Promise.resolve(42), { adapter })()).toBe(
      42,
    );
    await expect(
      withLog('fail', () => Promise.reject(error), { adapter })(),
    ).rejects.toBe(error);
  }
});

test('LogTapeがフィルタと構造化属性を担当する', async () => {
  const records: LogRecord[] = [];
  const error = new Error('dummy-secret');
  configureSync({
    reset: true,
    sinks: {
      memory(record) {
        records.push(record);
      },
    },
    loggers: [
      { category: ['ts-logging-lab'], lowestLevel: 'error', sinks: ['memory'] },
      { category: ['logtape', 'meta'], lowestLevel: 'error', sinks: [] },
    ],
  });
  const adapter = new LogTapeAdapter();
  await withLog('ok', () => Promise.resolve(1), { adapter })();
  await expect(
    withLog('fail', () => Promise.reject(error), { adapter })(),
  ).rejects.toBe(error);
  expect(records).toHaveLength(1);
  expect(records[0]?.level).toBe('error');
  expect(records[0]?.message.join('')).toBe('Operation failed');
  expect(records[0]?.category).toEqual(['ts-logging-lab', 'operation']);
  expect(records[0]?.properties['eventId']).toBe('operation.failure');
  expect(records[0]?.properties['operation']).toBe('fail');
  expect(records[0]?.properties['phase']).toBe('failure');
  expect(JSON.stringify(records)).not.toContain('dummy-secret');
});
