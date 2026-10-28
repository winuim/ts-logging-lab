import { expect, expectTypeOf, test } from 'vitest';
import {
  createLogEvent,
  eventCatalog,
  parseLevelOverrides,
  withLog,
} from '../../src/index.js';
import type { EventId, LevelOverrides, LogEvent } from '../../src/index.js';

test('カタログのID・phase・既定値を網羅する', () => {
  for (const id of Object.keys(eventCatalog)) {
    expect(
      Object.values(eventCatalog).some((entry) => entry.eventId === id),
    ).toBe(true);
  }
  expect(createLogEvent('operation.start', 'op').level).toBe('info');
  expect(createLogEvent('operation.failure', 'op').level).toBe('error');
  expect(createLogEvent('operation.success', 'op').message).toBe(
    'Operation succeeded',
  );
});

test('上書きは割り当てだけを変え、メッセージと属性を混ぜない', () => {
  const attributes = { durationMs: 12, traceLabel: 'dummy' };
  const event = createLogEvent('operation.success', 'op', attributes, {
    'operation.success': 'debug',
  });
  expect(event.level).toBe('debug');
  expect(event.message).toBe('Operation succeeded');
  expect(event.attributes).toEqual(attributes);
  expect(event.attributes).not.toBe(attributes);
  expect(Object.isFrozen(event)).toBe(true);
});

test.each([
  null,
  [],
  { unknown: 'info' },
  { 'operation.start': 'fatal' },
  { 'operation.start': undefined },
])('不正な外部設定を拒否する（%j）', (input) => {
  expect(() => parseLevelOverrides(input)).toThrow(TypeError);
});

test('設定をコピーし、withLogから上書き済みイベントを送る', async () => {
  const input = { 'operation.start': 'debug' };
  const levels = parseLevelOverrides(input);
  input['operation.start'] = 'error';
  const events: LogEvent[] = [];
  await withLog('op', () => Promise.resolve(1), {
    levelOverrides: levels,
    adapter: {
      emit(event) {
        events.push(event);
      },
    },
  })();
  expect(events[0]?.level).toBe('debug');
  expect(events[1]?.level).toBe('info');
  expect(events[0]?.eventId).toBe('operation.start');
  expectTypeOf(events[0]?.eventId).toEqualTypeOf<EventId | undefined>();
});

export function invalidTypes(): void {
  // @ts-expect-error 未知のIDを受け付けない
  createLogEvent('unknown', 'op');
  // @ts-expect-error 不正レベルを受け付けない
  const invalid: LevelOverrides = { 'operation.start': 'fatal' };
  void Object.keys(invalid);
}

test('診断カタログは操作の成否と別phaseを持つ', () => {
  expect(
    createLogEvent('http.response', 'page.diagnostic', { httpStatus: 404 }),
  ).toMatchObject({ category: 'http', phase: 'diagnostic', level: 'info' });
  expect(createLogEvent('http.failed', 'page.diagnostic').level).toBe(
    'warning',
  );
  expect(createLogEvent('page.console', 'page.diagnostic').level).toBe('info');
  expect(createLogEvent('page.exception', 'page.diagnostic').level).toBe(
    'error',
  );
});
