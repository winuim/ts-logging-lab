import { captureResourceAttributes } from './resource-context.js';
import {
  beforeContext,
  afterContext,
  extractSafely,
} from './context-extractor.js';
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
  options: LogOptions<Result> = {},
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
    const resourceAttributes = captureResourceAttributes(
      options.resources,
      options.resource ?? this,
      options.resourceKind,
    );
    const attributes = maskArguments(
      options.argumentPolicy ?? defaultArgumentPolicy,
      operation,
      args,
    );
    const context = beforeContext(operation, args);
    const before = extractSafely(() => options.extractor?.before?.(context));
    emit('start', { ...before, ...attributes, ...resourceAttributes });
    const startedAt = performance.now();
    try {
      const result = await fn.apply(this, args);
      const durationMs = performance.now() - startedAt;
      const after = extractSafely(() =>
        options.extractor?.after?.(afterContext(context, result)),
      );
      emit(
        'success',
        { ...before, ...after, ...attributes, ...resourceAttributes },
        durationMs,
      );
      return result;
    } catch (error: unknown) {
      const durationMs = performance.now() - startedAt;
      const failure = Object.freeze({ ...context, failed: true });
      const extra = extractSafely(() => options.extractor?.error?.(failure));
      emit(
        'failure',
        { ...before, ...extra, ...attributes, ...resourceAttributes },
        durationMs,
      );
      throw error;
    }
  };
}
