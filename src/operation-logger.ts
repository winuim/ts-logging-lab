import { randomUUID } from 'node:crypto';
import { ConsoleAdapter } from './console-adapter.js';
import { createEmitter } from './log-event.js';
import type { LogAttributes, LogOptions, LogPhase } from './log-event.js';

const defaultAdapter = new ConsoleAdapter();

/** 抽出結果を浅くコピーする。型契約外の値やtoJSONは出力へ持ち込まない。 */
function extract<Value>(
  extractor: ((value: Value) => LogAttributes) | undefined,
  value: Value,
): LogAttributes | undefined {
  if (!extractor) return undefined;
  const extracted = extractor(value);
  // JS等から非同期関数を渡されても、属性として採用せず拒否を回収する。
  if (extracted instanceof Promise) {
    void extracted.catch(() => undefined);
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(extracted).filter(
      ([, entry]) =>
        entry === null ||
        typeof entry === 'string' ||
        typeof entry === 'boolean' ||
        (typeof entry === 'number' && Number.isFinite(entry)),
    ),
  );
}

/** IDとフェーズの組み立てを呼び出し単位で保持し、ログ処理の失敗を隔離する。 */
export function createOperationLogger<Args extends unknown[], Result>(
  operation: string,
  options: LogOptions<Args, Result> = {},
) {
  const emit = createEmitter(options.adapter ?? defaultAdapter, options);
  return {
    start(args: Args) {
      let operationId: string | undefined;
      try {
        operationId = randomUUID();
      } catch {
        // IDがなくても本体とフェーズ通知を継続する。
      }
      function notify<Value>(
        phase: LogPhase,
        extractor: ((value: Value) => LogAttributes) | undefined,
        value: Value,
        durationMs?: number,
      ): void {
        let attributes: LogAttributes | undefined;
        try {
          attributes = extract(extractor, value);
        } catch {
          // 抽出失敗時は属性を省き、フェーズは変えない。
        }
        emit({
          operation,
          phase,
          ...(operationId === undefined ? {} : { operationId }),
          ...(attributes === undefined ? {} : { attributes }),
          ...(durationMs === undefined ? {} : { durationMs }),
        });
      }
      notify('start', options.extractor?.start, args);
      return {
        success(result: Result, durationMs: number) {
          notify('success', options.extractor?.success, result, durationMs);
        },
        failure(error: unknown, durationMs: number) {
          notify('failure', options.extractor?.failure, error, durationMs);
        },
      };
    },
  };
}
