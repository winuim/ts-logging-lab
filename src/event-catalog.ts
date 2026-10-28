import type { LogAttributes, LogEvent, LogLevel } from './log-event.js';

interface Definition {
  eventId: string;
  category: string;
  defaultLevel: LogLevel;
  message: string;
  phase: 'start' | 'success' | 'failure';
}

export const eventCatalog = Object.freeze({
  'operation.start': Object.freeze({
    eventId: 'operation.start',
    category: 'operation',
    defaultLevel: 'info',
    message: 'Operation started',
    phase: 'start',
  }),
  'operation.success': Object.freeze({
    eventId: 'operation.success',
    category: 'operation',
    defaultLevel: 'info',
    message: 'Operation succeeded',
    phase: 'success',
  }),
  'operation.failure': Object.freeze({
    eventId: 'operation.failure',
    category: 'operation',
    defaultLevel: 'error',
    message: 'Operation failed',
    phase: 'failure',
  }),
} satisfies Record<string, Definition>);

export type EventId = keyof typeof eventCatalog;
export type LevelOverrides = Readonly<Partial<Record<EventId, LogLevel>>>;

function isEventId(value: string): value is EventId {
  return Object.hasOwn(eventCatalog, value);
}
function isLevel(value: unknown): value is LogLevel {
  return (
    value === 'debug' ||
    value === 'info' ||
    value === 'warning' ||
    value === 'error'
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** JSON等の外部設定はここで検証し、キーとレベルをコピーする。 */
export function parseLevelOverrides(value: unknown): LevelOverrides {
  if (!isRecord(value)) throw new TypeError('Expected an event level map');
  const result: Partial<Record<EventId, LogLevel>> = {};
  for (const [key, level] of Object.entries(value)) {
    if (!isEventId(key) || !isLevel(level))
      throw new TypeError('Invalid event level override');
    result[key] = level;
  }
  return Object.freeze(result);
}

export function createLogEvent(
  id: EventId,
  operation: string,
  attributes: LogAttributes = {},
  overrides: LevelOverrides = {},
): LogEvent {
  if (!isEventId(id)) throw new TypeError('Unknown event ID');
  const definition = eventCatalog[id];
  const level = overrides[id] ?? definition.defaultLevel;
  if (!isLevel(level)) throw new TypeError('Invalid event level');
  return Object.freeze({
    eventId: id,
    category: definition.category,
    operation,
    phase: definition.phase,
    level,
    message: definition.message,
    attributes: Object.freeze({ ...attributes }),
  });
}
