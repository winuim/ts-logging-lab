import type { EventId, LevelOverrides } from './event-catalog.js';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';
export type LogAttributes = Readonly<
  Record<string, string | number | boolean | null>
>;
export interface LogEvent {
  readonly eventId: EventId;
  readonly category: string;
  readonly operation: string;
  readonly phase: 'start' | 'success' | 'failure';
  readonly level: LogLevel;
  readonly message: string;
  readonly attributes: LogAttributes;
}
export interface LogAdapter {
  emit(event: LogEvent): void | Promise<void>;
}
export interface LogOptions {
  levelOverrides?: LevelOverrides;
  adapter?: LogAdapter;
}

/** 出力失敗を本体へ伝播させない。完了・flushを保証する関数ではない。 */
export function emitSafely(adapter: LogAdapter, event: LogEvent): void {
  try {
    const result = adapter.emit(event);
    if (result) void result.catch(() => undefined);
  } catch {
    // 別Sinkや再試行は実装せず、出力の欠落を許容する。
  }
}
