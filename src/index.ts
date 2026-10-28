export { withLog } from './with-log.js';
export {
  withPageLogging,
  withBrowserLogging,
  withKeyboardLogging,
  withLocatorLogging,
} from './with-page-logging.js';
export { createLoggingProxy } from './logging-proxy.js';
export type { LoggingProxyOptions } from './logging-proxy.js';
export { unwrap } from './proxy-registry.js';
export { LogTapeAdapter } from './logtape-adapter.js';
export { emitSafely } from './log-event.js';
export type {
  LogAdapter,
  LogEvent,
  LogLevel,
  LogAttributes,
  LogOptions,
} from './log-event.js';
export {
  eventCatalog,
  createLogEvent,
  parseLevelOverrides,
} from './event-catalog.js';
export type { EventId, LevelOverrides } from './event-catalog.js';
export {
  REDACTED,
  createArgumentPolicy,
  createPuppeteerPolicy,
  maskArguments,
  argumentSnapshot,
  defaultArgumentPolicy,
} from './masking-policy.js';
export type {
  ArgumentPolicy,
  ArgumentRule,
  ArgumentValue,
} from './masking-policy.js';
export {
  navigationContext,
  safeUrlAttributes,
  safeSelectorAttributes,
} from './context-extractor.js';
export type {
  ContextExtractor,
  BeforeContext,
  AfterContext,
  ErrorContext,
} from './context-extractor.js';
