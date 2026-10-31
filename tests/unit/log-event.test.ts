import { afterEach, expect, test, vi } from 'vitest';
import { ConsoleAdapter, createEmitter } from '../../src/index.js';
import type { OperationEvent } from '../../src/index.js';

afterEach(() => vi.restoreAllMocks());

test('イベント契約にない秘密属性を出力へ渡さない', () => {
  const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const event: OperationEvent & {
    args: string[];
    result: string;
    error: Error;
  } = {
    operation: 'work',
    phase: 'success',
    durationMs: 12.5,
    args: ['dummy-password'],
    result: 'dummy-token',
    error: new Error('dummy-cookie'),
  };
  createEmitter(new ConsoleAdapter())(event);
  expect(output).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({
      operation: 'work',
      phase: 'success',
      durationMs: 12.5,
      level: 'info',
      message: 'Operation succeeded',
    }),
  );
  expect(event.args).toEqual(['dummy-password']);
});

test('入力のtoJSONを出力イベントへ持ち込まない', () => {
  const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const toJSON = vi.fn(() => 'dummy-authorization');
  const event: OperationEvent & { toJSON: typeof toJSON } = {
    operation: 'work',
    phase: 'start',
    toJSON,
  };
  createEmitter(new ConsoleAdapter())(event);
  expect(toJSON).not.toHaveBeenCalled();
  expect(output).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({
      operation: 'work',
      phase: 'start',
      level: 'info',
      message: 'Operation started',
    }),
  );
});
