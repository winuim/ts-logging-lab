import type { LogAdapter, LogEvent } from './log-event.js';

/** 一行一イベントのNDJSON。出力先の追加はLogAdapter実装で行う。 */
export class ConsoleAdapter implements LogAdapter {
  emit(event: LogEvent): void {
    console.info(JSON.stringify(event));
  }
}
