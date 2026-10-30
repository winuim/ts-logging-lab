import { ConsoleAdapter } from './console-adapter.js';
import { createEmitter } from './log-event.js';
import type { LogOptions } from './log-event.js';

const defaultAdapter = new ConsoleAdapter();

/** Promiseの同一性は保証しないが、解決値・拒否理由・this・引数を保持する。 */
export function withLog<This, Args extends unknown[], Result>(
  operation: string,
  fn: (this: This, ...args: Args) => Promise<Result>,
  options: LogOptions = {},
): (this: This, ...args: Args) => Promise<Result> {
  const emit = createEmitter(options.adapter ?? defaultAdapter);

  return async function (this: This, ...args: Args): Promise<Result> {
    emit({ operation, phase: 'start' });
    const startedAt = performance.now();
    try {
      const result = await fn.apply(this, args);
      emit({ operation, phase: 'success', durationMs: performance.now() - startedAt });
      return result;
    } catch (error: unknown) {
      emit({ operation, phase: 'failure', durationMs: performance.now() - startedAt });
      throw error;
    }
  };
}
