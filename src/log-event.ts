export type LogPhase = 'start' | 'success' | 'failure';
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

export interface OperationEvent {
  readonly operation: string;
  readonly phase: LogPhase;
  readonly durationMs?: number;
}
export interface LogEvent extends OperationEvent {
  readonly level: LogLevel;
  readonly message: string;
}
export interface LogAdapter {
  emit(event: LogEvent): void | Promise<void>;
}
export interface LogOptions {
  readonly adapter?: LogAdapter;
}

const levels: Record<LogPhase, LogLevel> = {
  start: 'info',
  success: 'info',
  failure: 'error',
};
const messages: Record<LogPhase, string> = {
  start: 'Operation started',
  success: 'Operation succeeded',
  failure: 'Operation failed',
};

/** 変換と安全な出力を一か所に集め、実行制御から切り離す。 */
export function createEmitter(
  adapter: LogAdapter,
): (event: OperationEvent) => void {
  return (event) => {
    const logEvent: LogEvent = {
      operation: event.operation,
      phase: event.phase,
      ...(event.durationMs === undefined
        ? {}
        : { durationMs: event.durationMs }),
      level: levels[event.phase],
      message: messages[event.phase],
    };
    try {
      const result = adapter.emit(logEvent);
      if (result) void Promise.resolve(result).catch(() => undefined);
    } catch {
      // ログ出力障害は本体処理の結果を変えない。
    }
  };
}
