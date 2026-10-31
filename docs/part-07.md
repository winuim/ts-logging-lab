# 第7回：AsyncLocalStorageで処理単位のログを関連付ける

## 課題

第6回までの操作名・フェーズ・カテゴリ・レベル・処理時間だけでは、並行するバッチやシナリオのログが混ざる。同じ操作を含む一連の処理を、すべての関数へIDを引数で渡さずに関連付けたい。

`runId`はバッチやシナリオの1回の実行を識別する。個々の操作呼び出し、イベントの種類、Browser/Pageのリソース、traceId/spanIdを識別するものではない。同じ実行内の複数操作には共通の値を付ける。

## 設計上の選択

公開APIは`withRunContext(context, callback)`と`RunContext`型。文脈はreadonlyな`runId: string`だけに限定し、呼び出し側が秘密を含まない値を用意する。IDは生成しない。URL・Cookie・入力値・例外や任意属性を格納するAPIにはしない。

Node.js標準の`AsyncLocalStorage.run()`を使う。入口で`runId`だけを新しいオブジェクトへコピーし、freezeして保存する。入力オブジェクトの後からの変更や余分な属性・`toJSON`を持ち込まない。型契約に従う文字列を受け取り、実行時の型変換やIDの検証・正規化は行わない。

コールバックをasync関数で包まず、`run()`の戻り値を直接返す。同期戻り値・Promise自体の同一性・同期throw・Promiseの拒否理由を保つ。入れ子の`run()`が戻ると呼び出し元は外側の文脈に戻り、内側で作った非同期処理は内側の文脈で続く。成功・例外・拒否のいずれでも外側へ復元される。

`createEmitter`はイベントを生成するたびに現在の文脈を読み、`LogEvent`の任意の`runId`へ付与する。文脈がなければプロパティ自体を追加しない。Emitter生成時やProxyの初回ラップ時に固定すると、共有ラッパーの並行利用で誤ったIDを付けてしまう。カテゴリ・フェーズ別レベルは従来どおり設定時の値を使い、runIdだけは実行時に解決する。

`withLog`は実行・計測・通知を担当し、文脈を開始しない。`OperationEvent`にもrunIdを追加しない。ConsoleAdapterとカスタムAdapterは同じrunId付きイベントを受け取る。Proxyの同一性、メソッドキャッシュ、子ラッパーへの設定引き継ぎ、初回設定優先は変更しない。

## 実装と実行例

次は公開APIを使った完全な小例。

```ts
import { withLog, withRunContext } from '../src/index.js';

const loggedWork = withLog(
  'work',
  async () => {
    await Promise.resolve();
    return 42;
  },
  {
    category: 'batch',
    levels: { start: 'debug', success: 'debug' },
  },
);

await Promise.all([
  withRunContext({ runId: 'run-A' }, () => loggedWork()),
  withRunContext({ runId: 'run-B' }, () => loggedWork()),
]);
```

Aの開始・成功ログには`run-A`、Bには`run-B`が付く。ラッパーは文脈の外で一度だけ作っている。文脈の入口はバッチ・シナリオ全体とし、複数のログ操作をその中で呼び出す。

```sh
npm run browser:install
npm run example:part-07
```

`examples/part-07.mjs`は同一HOFの並行利用、文脈外で用意したBrowser/Page/Keyboard/Locatorの再利用、内側の失敗後の外側文脈の復元、文脈なしのログを実行する。実Chromeでは`about:blank`とローカルHTMLだけを使用する。ログの処理時間は実行環境で変わる。

## テスト

単体テストはawaitと入れ子の非同期関数、同一ラッパーをゲートで交互に進める並行実行、成功・失敗・同期例外、入れ子の復元、文脈なしでプロパティがないことを確認する。入力文脈の変更や余分な属性・`toJSON`が出力に影響しないこと、元のthis・引数・結果・拒否理由、同期／非同期の出力失敗の隔離も確認する。型検査ではreadonly、必須の文字列runId、戻り値の推論を確認する。

実Chrome統合テストでは事前にラップしたBrowserからPage・Keyboard・Locatorとチェーンを用意し、同じキャッシュ済みラッパーを別のrunIdで再利用する。初回設定のカテゴリ・レベルを保ちながら、開始・成功・失敗へ実行時のIDが付くことを検証する。

## 残る課題と境界

Node.js内のPromise／async-awaitを中心に扱う。Puppeteerのブラウザ内JavaScript、別プロセス、通信先へrunIdが自動伝播するわけではない。任意のコールバックAPIやEventEmitterへの伝播は保証しない。

`run()`内で生成した非同期処理は文脈を引き継ぐ。待機していないバックグラウンド処理にも残り得るため、コールバック完了時にすべての子処理から文脈が消えるという保証はない。待機する処理の範囲は呼び出し側で管理する。

OpenTelemetry用ContextManagerの自作、traceId/spanIdの生成・伝播、Span管理、HTTPヘッダーによる伝播は扱わない。マスキング・任意属性・イベントカタログ・リソース識別・フィルタリング・出力完了保証も追加しない。第8回以降の構成と改訂版タグの方針は未確定。Zenn記事は別作業とする。
