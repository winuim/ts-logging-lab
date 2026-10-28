import type {
  ConsoleMessage,
  HTTPRequest,
  HTTPResponse,
  Page,
} from 'puppeteer';
import { captureCorrelation } from './correlation.js';
import { createLogEvent, parseLevelOverrides } from './event-catalog.js';
import type { EventId } from './event-catalog.js';
import { emitSafely } from './log-event.js';
import type { LogAttributes, LogOptions } from './log-event.js';
import { LogTapeAdapter } from './logtape-adapter.js';
import { unwrap } from './proxy-registry.js';
import { captureResourceAttributes } from './resource-context.js';

export type DiagnosticOptions = Pick<
  LogOptions,
  'adapter' | 'resources' | 'correlation' | 'levelOverrides'
>;
const subscriptions = new WeakMap<Page, () => void>();
const defaultAdapter = new LogTapeAdapter();
const methods = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'CONNECT',
  'TRACE',
]);
const consoleTypes = new Set([
  'log',
  'debug',
  'info',
  'error',
  'warn',
  'dir',
  'dirxml',
  'table',
  'trace',
  'clear',
  'startGroup',
  'startGroupCollapsed',
  'endGroup',
  'assert',
  'profile',
  'profileEnd',
  'count',
  'timeEnd',
  'verbose',
]);

/** 同じ実Pageは最初の購読設定を採用し、同じ解除関数を返す。 */
export function subscribeDiagnostics(
  page: Page,
  options: DiagnosticOptions = {},
): () => void {
  const raw = unwrap(page);
  const existing = subscriptions.get(raw);
  if (existing) return existing;
  if (raw.isClosed()) throw new TypeError('Cannot subscribe to a closed page');
  const overrides = parseLevelOverrides(options.levelOverrides ?? {});
  const adapter = options.adapter ?? defaultAdapter;
  let active = true;
  function report(id: EventId, attributes: () => LogAttributes): void {
    if (!active) return;
    try {
      emitSafely(
        adapter,
        createLogEvent(
          id,
          'page.diagnostic',
          {
            ...attributes(),
            ...captureResourceAttributes(options.resources, raw, 'page'),
            ...captureCorrelation(options.correlation),
          },
          overrides,
        ),
      );
    } catch {
      // イベントの抽出・出力失敗を、ブラウザのイベント処理へ伝播させない。
    }
  }
  function response(value: HTTPResponse): void {
    report('http.response', () => {
      const status = value.status();
      const method = value.request().method();
      return {
        httpStatus:
          Number.isInteger(status) && status >= 100 && status <= 599
            ? status
            : 0,
        httpMethod: methods.has(method) ? method : 'OTHER',
      };
    });
  }
  function failed(value: HTTPRequest): void {
    report('http.failed', () => {
      const method = value.method();
      return { httpMethod: methods.has(method) ? method : 'OTHER' };
    });
  }
  function consoleMessage(value: ConsoleMessage): void {
    report('page.console', () => {
      const type = value.type();
      return { consoleType: consoleTypes.has(type) ? type : 'OTHER' };
    });
  }
  function exception(): void {
    report('page.exception', () => ({ hasException: true }));
  }
  function dispose(): void {
    if (!active) return;
    active = false;
    raw.off('response', response);
    raw.off('requestfailed', failed);
    raw.off('console', consoleMessage);
    raw.off('pageerror', exception);
    raw.off('close', dispose);
    subscriptions.delete(raw);
  }
  try {
    raw.on('response', response);
    raw.on('requestfailed', failed);
    raw.on('console', consoleMessage);
    raw.on('pageerror', exception);
    raw.on('close', dispose);
    subscriptions.set(raw, dispose);
    return dispose;
  } catch (error: unknown) {
    dispose();
    throw error;
  }
}
