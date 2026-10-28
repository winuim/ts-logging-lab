import { defaultArgumentPolicy, maskArguments } from './masking-policy.js';
import { createLogEvent, parseLevelOverrides } from './event-catalog.js';
import type { EventId } from './event-catalog.js';
import { emitSafely } from './log-event.js';
import type { LogAttributes, LogEvent, LogOptions } from './log-event.js';
import { LogTapeAdapter } from './logtape-adapter.js';

const defaultAdapter = new LogTapeAdapter();

/** 解決値と拒否理由を保持する。返すPromise自体の同一性は保持しない。 */
export function withLog<This, Args extends unknown[], Result>(
  operation: string,
  fn: (this: This, ...args: Args) => Promise<Result>,
  options: LogOptions = {},
): (this: This, ...args: Args) => Promise<Result> {
  const adapter = options.adapter ?? defaultAdapter;
  const overrides = parseLevelOverrides(options.levelOverrides ?? {});
  const ids = {
    start: 'operation.start',
    success: 'operation.success',
    failure: 'operation.failure',
  } satisfies Record<LogEvent['phase'], EventId>;
  function emit(
    phase: LogEvent['phase'],
    attributes: LogAttributes,
    durationMs?: number,
  ): void {
    const event = createLogEvent(
      ids[phase],
      operation,
      durationMs === undefined ? attributes : { ...attributes, durationMs },
      overrides,
    );
    emitSafely(adapter, event);
  }
  return async function (this: This, ...args: Args): Promise<Result> {
    const attributes = maskArguments(
      options.argumentPolicy ?? defaultArgumentPolicy,
      operation,
      args,
    );
    emit('start', attributes);
    const startedAt = performance.now();
    try {
      const result = await fn.apply(this, args);
      emit('success', attributes, performance.now() - startedAt);
      return result;
    } catch (error: unknown) {
      emit('failure', attributes, performance.now() - startedAt);
      throw error;
    }
  };
}
