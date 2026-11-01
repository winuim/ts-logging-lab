import { currentRunId } from './run-context.js';

export type LogPhase = 'start' | 'success' | 'failure';
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';
export type LogAttributes = Readonly<
  Record<string, string | number | boolean | null>
>;
export interface ContextExtractor<
  Args extends unknown[] = unknown[],
  Result = unknown,
> {
  readonly start?: (args: Args) => LogAttributes;
  readonly success?: (result: Result) => LogAttributes;
  readonly failure?: (error: unknown) => LogAttributes;
}

export interface OperationEvent {
  readonly kind?: 'operation';
  readonly operation: string;
  readonly phase: LogPhase;
  readonly durationMs?: number;
  readonly operationId?: string;
  readonly attributes?: LogAttributes;
}
export interface LogEvent extends OperationEvent {
  readonly runId?: string;
  readonly category?: string;
  readonly level: LogLevel;
  readonly message: string;
}
export interface DiagnosticEvent {
  readonly kind: 'diagnostic';
  readonly event: string;
  readonly level: LogLevel;
  readonly attributes?: LogAttributes;
}
export interface DiagnosticLogEvent extends DiagnosticEvent {
  readonly message: string;
  readonly category?: string;
  readonly runId?: string;
  readonly operation?: never;
  readonly phase?: never;
  readonly operationId?: never;
  readonly durationMs?: never;
}
export type LogRecord = LogEvent | DiagnosticLogEvent;
export interface LogAdapter {
  emit(event: LogRecord): void | Promise<void>;
}
export interface EmitterOptions {
  readonly category?: string | undefined;
  readonly levels?:
    Readonly<Partial<Record<LogPhase, LogLevel | undefined>>> | undefined;
}
export interface LogOptions<
  Args extends unknown[] = unknown[],
  Result = unknown,
> extends EmitterOptions {
  readonly adapter?: LogAdapter;
  readonly extractor?: ContextExtractor<Args, Result>;
}

const defaultLevels: Readonly<Record<LogPhase, LogLevel>> = {
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
  options: EmitterOptions = {},
): (event: OperationEvent | DiagnosticEvent) => void {
  const category = options.category;
  const levels = {
    start: options.levels?.start ?? defaultLevels.start,
    success: options.levels?.success ?? defaultLevels.success,
    failure: options.levels?.failure ?? defaultLevels.failure,
  };
  return (event) => {
    const runId = currentRunId();
    const context = {
      ...(category === undefined ? {} : { category }),
      ...(runId === undefined ? {} : { runId }),
    };
    const logEvent: LogRecord =
      event.kind === 'diagnostic'
        ? {
            kind: 'diagnostic',
            event: event.event,
            level: event.level,
            message: 'Diagnostic event',
            ...(event.attributes === undefined
              ? {}
              : { attributes: event.attributes }),
            ...context,
          }
        : {
            operation: event.operation,
            phase: event.phase,
            ...(event.durationMs === undefined
              ? {}
              : { durationMs: event.durationMs }),
            ...(event.operationId === undefined
              ? {}
              : { operationId: event.operationId }),
            ...(event.attributes === undefined
              ? {}
              : { attributes: event.attributes }),
            ...(category === undefined ? {} : { category }),
            ...(runId === undefined ? {} : { runId }),
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
