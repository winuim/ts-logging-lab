import type { DiagnosticLogger } from './diagnostic-logger.js';
import { unwrap } from './proxy-registry.js';

const subscriptions = new WeakMap<object, () => void>();

/** 同一Pageは最初のloggerを使う。所有者がfinallyで解除する。 */
export function subscribePageDiagnostics(
  page: {
    on(event: 'pageerror' | 'requestfailed', handler: () => void): unknown;
    off(event: 'pageerror' | 'requestfailed', handler: () => void): unknown;
  },
  logger: DiagnosticLogger,
): () => void {
  const target = unwrap(page);
  const existing = subscriptions.get(target);
  if (existing) return existing;
  let active = true;
  function notify(event: string, level: 'warning' | 'error') {
    if (!active) return;
    try {
      // ペイロードには触れない。URL・エラー詳細・本文は一切抽出しない。
      logger.log(event, level);
    } catch {
      // 差し替えたloggerの失敗もPuppeteerへ伝播させない。
    }
  }
  const pageerror = () => {
    notify('puppeteer.pageerror', 'error');
  };
  const requestfailed = () => {
    notify('puppeteer.requestfailed', 'warning');
  };
  function dispose() {
    if (!active) return;
    active = false;
    try {
      target.off('pageerror', pageerror);
    } finally {
      try {
        target.off('requestfailed', requestfailed);
      } finally {
        subscriptions.delete(target);
      }
    }
  }
  try {
    target.on('pageerror', pageerror);
    target.on('requestfailed', requestfailed);
  } catch (error) {
    dispose();
    throw error;
  }
  subscriptions.set(target, dispose);
  return dispose;
}
