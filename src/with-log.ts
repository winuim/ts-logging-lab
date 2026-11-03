import { createOperationLogger } from './operation-logger.js';
import type { LogOptions } from './log-event.js';
import { isPromiseLike } from './is-promise-like.js';
import { observePromise } from './observe-promise.js';

/** 同期の戻り値・throwとPromiseの解決値・拒否理由、this・引数を保持する。Promiseの同一性は保証しない。 */
export function withLog<This, Args extends unknown[], Result>(
  operation: string,
  fn: (this: This, ...args: Args) => Result,
  options?: LogOptions<NoInfer<Args>, NoInfer<Awaited<Result>>>,
): (
  this: This,
  ...args: Args
) => Result extends PromiseLike<unknown> ? Promise<Awaited<Result>> : Result;
export function withLog<This, Args extends unknown[], Result>(
  operation: string,
  fn: (this: This, ...args: Args) => Result | PromiseLike<Result>,
  options: LogOptions<Args, Result> = {},
): (this: This, ...args: Args) => Result | Promise<Awaited<Result>> {
  const logger = createOperationLogger<Args, Result>(operation, options);

  return function (
    this: This,
    ...args: Args
  ): Result | Promise<Awaited<Result>> {
    const log = logger.start(args);
    const startedAt = performance.now();
    const elapsedMs = () => performance.now() - startedAt;
    try {
      const result = fn.apply(this, args);
      if (isPromiseLike(result)) {
        return observePromise(result, {
          success: (value) => {
            log.success(value, elapsedMs());
          },
          failure: (error) => {
            log.failure(error, elapsedMs());
          },
        });
      }
      log.success(result, elapsedMs());
      return result;
    } catch (error: unknown) {
      log.failure(error, elapsedMs());
      throw error;
    }
  };
}
