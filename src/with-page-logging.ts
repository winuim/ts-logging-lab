import type { Page } from 'puppeteer';

import { withLog } from './with-log.js';

/** Page.gotoだけをログ化する。戻り値や子オブジェクトはラップしない。 */
export function withPageLogging<T extends Pick<Page, 'goto'>>(page: T): T {
  return new Proxy(page, {
    get(target, property) {
      if (property === 'goto') {
        return withLog('page.goto', target.goto.bind(target));
      }

      // getterにもProxyではなく実インスタンスをthisとして渡す。
      const value: unknown = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;

      // ログ対象外も含め、メソッドのthisを実インスタンスに固定する。
      const bound: unknown = value.bind(target);
      return bound;
    },
    set(target, property, value: unknown) {
      return Reflect.set(target, property, value, target);
    },
  });
}
