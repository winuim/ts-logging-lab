import type { GoToOptions, HTTPResponse, Page } from 'puppeteer';
import { expectTypeOf, test } from 'vitest';

import { withPageLogging } from '../../src/index.js';
import type { LogOptions } from '../../src/index.js';

test('Pageを受け取り同じ公開型を返す', () => {
  expectTypeOf(withPageLogging<Page>).parameters.toEqualTypeOf<
    [Page, options?: LogOptions | undefined]
  >();
  expectTypeOf(withPageLogging<Page>).returns.toEqualTypeOf<Page>();
});

// 実ブラウザを作らずtscでPageのAPIを検証する。
export function checkPageTypes(raw: Page): void {
  const page = withPageLogging(raw);
  expectTypeOf<typeof page.goto>().parameters.toEqualTypeOf<
    [url: string, options?: GoToOptions | undefined]
  >();
  expectTypeOf<typeof page.goto>().returns.toEqualTypeOf<
    Promise<HTTPResponse | null>
  >();
  // @ts-expect-error URLの型はstring
  void page.goto(123);
  // @ts-expect-error waitUntilは任意の文字列ではない
  void page.goto('about:blank', { waitUntil: 'invalid' });
  // @ts-expect-error Page.gotoの契約がないオブジェクトは渡せない
  withPageLogging({});
}
