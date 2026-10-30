import type { LogAdapter, LogEvent } from './log-event.js';

/** レベルに応じたconsoleメソッドへ1行1JSONで出力する。 */
export class ConsoleAdapter implements LogAdapter {
  emit(event: LogEvent): void {
    const message = JSON.stringify(event);
    switch (event.level) {
      case 'debug':
        console.debug(message);
        break;
      case 'info':
        console.info(message);
        break;
      case 'warning':
        console.warn(message);
        break;
      case 'error':
        console.error(message);
        break;
    }
  }
}
