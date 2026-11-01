import type { Logger } from 'pino';
import type { LogAdapter, LogEvent, LogLevel } from './log-event.js';

const methods: Readonly<Record<LogLevel, 'debug' | 'info' | 'warn' | 'error'>> =
  {
    debug: 'debug',
    info: 'info',
    warning: 'warn',
    error: 'error',
  };

/** イベント生成は共通側に残し、出力・フィルタ・RedactionはPinoへ委ねる。 */
export class PinoAdapter implements LogAdapter {
  constructor(
    private readonly logger: Pick<Logger, 'debug' | 'info' | 'warn' | 'error'>,
  ) {}

  emit(event: LogEvent): void {
    const { level, message, ...fields } = event;
    this.logger[methods[level]](fields, message);
  }
}
