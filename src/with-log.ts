import { createOperationLogger } from './operation-logger.js';
import type { LogOptions } from './log-event.js';

/** Promiseの同一性は保証しないが、解決値・拒否理由・this・引数を保持する。 */
export function withLog<This, Args extends unknown[], Result>(
  operation: string,
  fn: (this: This, ...args: Args) => Promise<Result>,
  options: LogOptions<NoInfer<Args>, NoInfer<Result>> = {},
): (this: This, ...args: Args) => Promise<Result> {
  const logger = createOperationLogger<Args, Result>(operation, options);

  return async function (this: This, ...args: Args): Promise<Result> {
    const log = logger.start(args);
    const startedAt = performance.now();
    try {
      const result = await fn.apply(this, args);
      log.success(result, performance.now() - startedAt);
      return result;
    } catch (error: unknown) {
      log.failure(error, performance.now() - startedAt);
      throw error;
    }
  };
}
