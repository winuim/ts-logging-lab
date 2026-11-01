import { ConsoleAdapter } from './console-adapter.js';
import { createEmitter } from './log-event.js';
import type { LogAdapter, LogAttributes, LogLevel } from './log-event.js';

export interface DiagnosticOptions {
  readonly adapter?: LogAdapter;
  readonly category?: string;
}
export interface DiagnosticLogger {
  log(event: string, level: LogLevel, attributes?: LogAttributes): void;
}

/** イベント名も属性も、呼び出し側が秘密を含まない値を選ぶ。 */
export function createDiagnosticLogger(
  options: DiagnosticOptions = {},
): DiagnosticLogger {
  const emit = createEmitter(options.adapter ?? new ConsoleAdapter(), options);
  return {
    log(event, level, attributes) {
      try {
        // 浅いコピーで後の変更・toJSON・型契約外のオブジェクトを遮断する。
        const copied =
          attributes === undefined
            ? undefined
            : Object.fromEntries(
                Object.entries(attributes).filter(
                  ([, value]) =>
                    value === null ||
                    typeof value === 'string' ||
                    typeof value === 'boolean' ||
                    (typeof value === 'number' && Number.isFinite(value)),
                ),
              );
        emit({
          kind: 'diagnostic',
          event,
          level,
          ...(copied === undefined ? {} : { attributes: copied }),
        });
      } catch {
        // 属性読み取り等の失敗でもイベント発火元へ例外を返さない。
      }
    },
  };
}
