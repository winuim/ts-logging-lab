import { emitSafely } from './log-event.js';
import type { LogEvent, LogOptions } from './log-event.js';
import { LogTapeAdapter } from './logtape-adapter.js';

const defaultAdapter = new LogTapeAdapter();

/** 解決値と拒否理由を保持する。返すPromise自体の同一性は保持しない。 */
export function withLog<This, Args extends unknown[], Result>(
  operation: string,
  fn: (this: This, ...args: Args) => Promise<Result>,
  options: LogOptions = {},
): (this: This, ...args: Args) => Promise<Result> {
  const adapter = options.adapter ?? defaultAdapter;
  function emit(phase: LogEvent['phase'], durationMs?: number): void {
    const suffix =
      durationMs === undefined ? '' : ` (${durationMs.toFixed(2)} ms)`;
    emitSafely(adapter, {
      operation,
      phase,
      level: phase === 'failure' ? 'error' : 'info',
      message: `${operation}: ${phase}${suffix}`,
      attributes: durationMs === undefined ? {} : { durationMs },
    });
  }
  return async function (this: This, ...args: Args): Promise<Result> {
    emit('start');
    const startedAt = performance.now();
    try {
      const result = await fn.apply(this, args);
      emit('success', performance.now() - startedAt);
      return result;
    } catch (error: unknown) {
      emit('failure', performance.now() - startedAt);
      throw error;
    }
  };
}
