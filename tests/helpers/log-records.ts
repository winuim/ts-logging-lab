import type { LogEvent } from '../../src/index.js';

function isLogEvent(value: unknown): value is LogEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'operation' in value &&
    typeof value.operation === 'string' &&
    'phase' in value &&
    ['start', 'success', 'failure'].includes(String(value.phase)) &&
    'level' in value &&
    ['debug', 'info', 'warning', 'error'].includes(String(value.level)) &&
    'message' in value &&
    typeof value.message === 'string' &&
    (!('durationMs' in value) || typeof value.durationMs === 'number')
  );
}

export function logRecords(calls: readonly (readonly unknown[])[]): LogEvent[] {
  return calls.map(([message]) => {
    if (typeof message !== 'string')
      throw new Error('Expected a JSON log line');
    const value: unknown = JSON.parse(message);
    if (!isLogEvent(value)) throw new Error('Expected a LogEvent');
    return value;
  });
}
