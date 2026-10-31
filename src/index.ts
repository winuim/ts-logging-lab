export { withLog } from './with-log.js';
export { withRunContext } from './run-context.js';
export type { RunContext } from './run-context.js';
export { createEmitter } from './log-event.js';
export type {
  LogPhase,
  LogLevel,
  OperationEvent,
  LogEvent,
  LogAdapter,
  LogOptions,
  EmitterOptions,
  LogAttributes,
  ContextExtractor,
} from './log-event.js';
export { ConsoleAdapter } from './console-adapter.js';
export { PinoAdapter } from './pino-adapter.js';
export {
  withPageLogging,
  withBrowserLogging,
  withKeyboardLogging,
  withLocatorLogging,
} from './with-page-logging.js';
export { createLoggingProxy } from './logging-proxy.js';
export type { LoggingProxyOptions } from './logging-proxy.js';
export { unwrap } from './proxy-registry.js';
