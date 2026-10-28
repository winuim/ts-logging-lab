import { getLogger } from '@logtape/logtape';
import type { LogAdapter, LogEvent } from './log-event.js';

/** フィルタ・整形・Sink設定は呼び出し側のLogTape設定へ委譲する。 */
export class LogTapeAdapter implements LogAdapter {
  emit(event: LogEvent): void {
    getLogger(['ts-logging-lab'])[event.level](event.message, {
      ...event.attributes,
      operation: event.operation,
      phase: event.phase,
    });
  }
}
