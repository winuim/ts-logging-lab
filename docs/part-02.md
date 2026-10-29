# 第2回：Proxy・Reflect・thisとprivate

[教材の一覧](../README.ja.md#全12回の一覧) · [完成タグ part-02](https://github.com/winuim/ts-logging-lab/tree/part-02)

このページは`part-02`時点の実装と制約を説明します。完成版との差は後続回で確認してください。

完成版では第3回以降のProxy共通化、同一性管理、構造化ログ等も適用されます。

`withPageLogging(page)`で実PageをProxy化します。ログ対象は`goto`だけです。`goto`は第1回の`withLog`で包み、開始・成功・失敗・処理時間を出力します。URL・引数・応答・生のエラーはログに含めません。

以下は`part-02`のAPIを使う例です。importパスは`docs/`内のTypeScriptファイルを想定しています。

```ts
import type { Page } from 'puppeteer';
import { withPageLogging } from '../src/index.js';

export async function navigate(raw: Page) {
  const page = withPageLogging(raw);
  const response = await page.goto('about:blank'); // HTTPResponse | null
  const keyboard = page.keyboard; // getterのthisも実Page
  const value = await page.evaluate(() => 6 * 7); // 対象外メソッドも動く
  return { response, keyboard, value };
}
```

`Reflect.get(target, property, target)`でgetterのreceiverを実体へ固定し、ログ対象外も含め関数値を実体へbindして返します。setterも`Reflect.set(target, property, value, target)`で実体を使います。これにより`#private`やnative内部スロットがProxyを実体と取り違える問題を避けます。

## 今回の境界

- 直接の呼び出し結果・拒否理由は同じ値を返します。ログ対象の`goto`には第1回と同じasyncラッパーの制約があり、Promise自体の同一性や同期throwの境界は保ちません。対象外メソッドにはasyncラッパーを付けないため、同期throwは同期throwのままです。
- `withPageLogging<T extends Pick<Page, 'goto'>>(page: T): T`はPage専用の小さな構造契約です。単体テストでは同じ契約を持つfixtureを使い、統合テストでは実Pageを使います。汎用のメソッド登録・型アサーション・共通Proxy基盤は追加しません。
- キーボードなどの子オブジェクト・メソッドの戻り値は再ラップしません。`this`を返すメソッドも実体を返すので、その先のチェーンはProxyを通りません。第3回以降の検討対象です。
- Proxyは元インスタンスとは別物です。メソッドは取得ごとにbindされるため関数の同一性を保たず、constructor等の関数値もbind対象になります。二重ラップ防止・キャッシュ・`unwrap`は未実装です。
- 対象は通常の未改変のPageです。書き換え禁止かつ再定義禁止の独自関数プロパティはProxyの不変条件により差し替えられず、適用対象外です。Proxyを完全に透明にする設計ではありません。

## ブラウザを使う検証

```sh
npm run browser:install
npm run test:integration
npm run example:part-02
```

Puppeteer **25.16.0**と、そのCLIが指定するChrome for Testingを使用します。`browser:install`はブラウザをPuppeteerのキャッシュへ取得します。ブラウザを起動できるローカル環境で実行してください。実行例・テストは`about:blank`・`data:` URL・ローカルHTMLを使い、外部Webサイトへアクセスしません。

通常の`npm ci`では`.puppeteerrc.cjs`の`skipDownload: true`でブラウザを取得しません。ブラウザなしの単体テストと、実ブラウザの統合テストは引き続き分離しています。GitHub Actionsは使用しません。
