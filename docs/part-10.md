# 第10回：別のログ発生源を共通Adapterへ接続する

この文書は[`part-10`タグ](https://github.com/winuim/ts-logging-lab/tree/part-10)（コミット`2b23935`）時点の設計・APIを説明します。後続回の機能は含めません。

## 課題：イベントは操作失敗ではない

第9回までの`withLog → createOperationLogger`は、呼び出しの開始・成功・失敗を通知します。一方、Puppeteerの`pageerror`はページ内JavaScriptの未処理例外、`requestfailed`はリクエストの失敗通知です。これらを`phase: failure`に変換すると、どの操作が失敗したかについて誤った意味を持たせてしまいます。

[Issue #48](https://github.com/winuim/ts-logging-lab/issues/48)では、操作を実行・計測しない`createDiagnosticLogger`を並列の発生源として追加します。

## 設計上の選択：既存の出力と新しい入力

```text
withLog  → createOperationLogger ─┐
                                 ├→ createEmitter → LogAdapter → Console / Pino
page.on → createDiagnosticLogger ─┘
```

既存の`LogEvent`は操作ログの型として維持し、`DiagnosticLogEvent`と合わせた`LogRecord`をAdapterの入力にします。`record.kind === 'diagnostic'`で判別でき、それ以外は操作ログです。操作ログは既存JSONを維持するためkindを新たに出力しません。診断ログは`kind`・`event`・`level`・固定の`message: 'Diagnostic event'`と任意の`category`・`runId`・`attributes`を持ちます。operation・phase・operationId・durationMsは生成しません。

`LogAdapter.emit`の引数は`LogEvent`から`LogRecord`に広がります。これは独自Adapter側に対応が必要な型契約の変更です。操作フィールドを無条件に読むAdapterはkindで分岐し、両形式を扱ってください。操作だけを集めるテストも判別してから保存します。既存の操作API・実行セマンティクス・JSON・Extractor・フェーズ別レベルは維持します。`createEmitter`は診断入力も受け、診断では指定されたlevelを使い、操作用levelsは参照しません。

ConsoleAdapterは共通levelでconsoleメソッドを選び、PinoAdapterは従来通りwarningをwarnへ、messageをmsgへ渡します。診断層にはPinoの依存を持ち込みません。同期throwとAdapterのPromise拒否は共通Emitterで回収します。出力の欠落を許容する設計であり、再試行・障害通知・flush保証はありません。

## 実装：小さな診断ロガーとPage購読

以下は実装済みの公開APIを使う最小例です。`page`は呼び出し側が生成したPuppeteer Page、`pinoLogger`はアプリケーションが生成したPinoロガーです。第9回の`withLog`実行例と同じく、教材ではPinoAdapterを明示的に指定します。APIの省略時のデフォルトはConsoleAdapterのままです。

```ts
const logger = createDiagnosticLogger({
  adapter: new PinoAdapter(pinoLogger),
  category: 'browser',
});
const dispose = subscribePageDiagnostics(page, logger);
try {
  await page.goto('about:blank');
} finally {
  dispose();
}
```

購読ヘルパーは`pageerror`をerror、`requestfailed`をwarningとして通知し、イベント引数を一切読みません。イベント名は固定の`puppeteer.pageerror`と`puppeteer.requestfailed`です。URL・ヘッダー・本文・console引数・例外message/stack・リクエスト失敗詳細を出力しません。ページ側のエラーはブラウザ内で発生した診断であり、Node.js側の操作Promiseの成否とは別です。

同じPageの購読はWeakMapで管理し、再呼び出しでは最初のloggerと同じ解除関数を返します。この教材のProxyと実Pageもunwrapにより同じキーにします。参照カウントは持たず、所有者を一つに定めてfinallyで解除します。解除は冪等で、解除後は再購読できます。登録途中に失敗した場合も登録済みハンドラーを解除します。on/off自体の失敗は呼び出し側へ返します。Pageの寿命に合わせた自動解除やclose監視は追加しません。WeakMapだけでは長寿命Pageのリスナーは解除できません。

ハンドラーはloggerの同期例外を隔離します。DiagnosticLoggerは同期void契約で、非同期Adapterの拒否回収はcreateDiagnosticLoggerを経由する場合に共通Emitterが担当します。

診断ロガーの任意属性はプリミティブだけを浅くコピーし、関数・ネストしたオブジェクト・非有限数を除きます。読み取り失敗ではその診断通知を省きます。これは文字列の安全性を判定するマスキングではありません。イベント名・カテゴリ・属性値は呼び出し側が秘密を含まないものを選んでください。PinoのRedactionは設定したパスとPino出力だけの追加保護で、Consoleや他Adapterへの保護にはなりません。

### runIdの範囲

Emitterは診断生成時のALS文脈を読みます。スコープ内で作ったPromise/タイマーから発火するとrunIdを引き継ぎ得ますが、リスナー登録時の文脈は保存しません。文脈外から後でemitするとrunIdは省略します。別runの中で発火すればそのrunのIDになります。

Puppeteerの通信・イベント配送は別の非同期経路を通るため、`withRunContext`内でページ操作を待っていても診断との相関を保証しません。今回、購読時runIdの明示固定は採用しません。長寿命Pageで過去のrunIdを付け続ける誤相関を避けるためです。operationIdや親子ID、OpenTelemetryの伝播は追加しません。

## テストと実行例

```sh
npm run browser:install
npm test
npm run test:integration
npm run example:part-10
```

単体テストはConsole/Pino双方の実出力、Pinoの抑制・Redaction、属性のコピーと除外、出力失敗、購読登録・重複・解除・再購読・部分登録失敗・ハンドラー失敗、await・並行文脈と文脈外のrunIdを検証します。型チェックでは判別共用体も確認します。

統合テストは実Chromeでページ内の未処理例外と、リクエストをinterceptionでabortした失敗通知を起こします。URLのダミートークンとエラー詳細が出ないこと、Proxyとの重複防止、解除後の通知停止を確認します。第10回の実行例はPinoAdapterに統一して両通知を出します。Console/Pinoの双方を扱えることは単体テストで検証します。ネットワークリクエストは送信前にabortし、外部サイトには接続しません。ログ行は実行して確認してください。時刻やブラウザ環境に依存する値を固定の実測結果として掲載しません。

## 残る課題

診断の網羅、リソースID、任意イベント向け汎用購読、イベントカタログ、購読所有権の高度な管理、完全な非同期相関は対象外です。次の[第11回](part-11.md)で既存機能を統合して検証し、全11回の連載を終えます。新しいAPIや実行コマンドは追加しません。記事はzenn-contentsで管理します。
