# 第6回：呼び出し側からカテゴリとログレベルを設定する

この文書は[`part-06`タグ](https://github.com/winuim/ts-logging-lab/tree/part-06)時点の設計・APIを説明します。後続回の機能は含めません。

## 課題

頻繁に実行する操作の開始・成功を`debug`として分類し、失敗は既定の`error`に保ちたい。また、関連する操作を`browser`というカテゴリで検索したい。第5回の`withLog → createEmitter → LogAdapter`という責務の分離を保ちながら、呼び出し側で設定する。

## 設計上の選択

`LogOptions`にreadonlyな`category`と`levels`を追加する。`levels`は`start`・`success`・`failure`の部分指定で、値は`debug`・`info`・`warning`・`error`。省略と明示的な`undefined`の両方を許容する。`exactOptionalPropertyTypes`の下でも`{ levels: { start: undefined } }`を指定できるよう、型に`undefined`を含める。

`createEmitter(adapter, options?)`がカテゴリを付与し、フェーズごとの設定を`??`で既定値へフォールバックする。既定値は開始・成功が`info`、失敗が`error`。設定はEmitter生成時に読み取り、共有の既定値を変更しない。従来の`createEmitter(adapter)`も使える。公開型`EmitterOptions`はカテゴリとレベル、`LogOptions`はそれにAdapter指定を加えたもの。

`withLog`は設定をEmitterへ渡し、実行・時間計測・通知を担当する。`OperationEvent`にはカテゴリやレベルを追加しない。出力の`LogEvent`には任意の`category`を追加し、未指定ならプロパティ自体を持たせない。固定メッセージと`operation`・`phase`・`durationMs`の意味は第5回と同じ。

カテゴリは操作の分類情報であり、ロガー名や階層的な設定キーではない。操作名と同じく秘密を含まない固定文字列を使う。カテゴリの階層化、カテゴリ別の設定、イベントID、イベントカタログは今回導入しない。

## 実装と実行例

公開APIを使う例（`goto`は呼び出し側が用意する非同期関数）。

```ts
const loggedGoto = withLog('page.goto', goto, {
  category: 'browser',
  levels: { start: 'debug', success: 'debug' },
});
```

開始・成功は`debug`、失敗は`error`になる。例えば開始ログは次の形になる（説明用の例示）。

```json
{
  "operation": "page.goto",
  "phase": "start",
  "category": "browser",
  "level": "debug",
  "message": "Operation started"
}
```

`ConsoleAdapter`は決定済みのレベルを`console.debug`・`console.info`・`console.warn`・`console.error`へ振り分ける。レベルの割り当てと出力可否の判定は別の責務であり、今回はフィルタリングや無効化を実装しない。`debug`へ下げても出力される。カスタムAdapterにも同じイベントが届く。

`createLoggingProxy`は`LogOptions`を引き継ぐ。`withBrowserLogging`・`withPageLogging`・`withKeyboardLogging`・`withLocatorLogging`も第2引数へ同じ設定を指定できる。Browserから生成したPage、PageのKeyboardやLocator、Locatorのチェーンにも設定を渡す。同じ実体の再ラップは最初の設定を使い、Proxyやメソッドの同一性を維持する。すでにラップされた子オブジェクトも最初の設定が優先される。

```ts
const browser = withBrowserLogging(rawBrowser, {
  category: 'browser',
  levels: { start: 'debug', success: 'debug' },
  adapter: myAdapter,
});
```

`npm run example:part-06`でHOFの成功・失敗と、BrowserからPage・Keyboard・Locatorへの引き継ぎを実行できる。事前に`npm run browser:install`でChromeを準備する。URLは`about:blank`とローカルHTMLを使い、外部サイトへ通信しない。

## テスト

単体テストでは各フェーズの部分上書き・全上書き、省略・`undefined`、カテゴリ有無のイベントとJSON、並行するラッパーの設定独立性を検証する。ConsoleAdapterのメソッド選択、カスタムAdapter、Proxyの初回設定とメソッドキャッシュも確認する。実Chrome統合テストではBrowserから子オブジェクトとチェーンへの設定引き継ぎ、失敗時の既定レベルを確認する。

イベント生成は引き続き許可項目だけをコピーする。余分な`args`・`result`・`error`・`toJSON`を出力へ持ち込まない。入力側のカテゴリやレベルも採用せず、Emitterの設定を使う。既存テストと合わせて`this`・引数・解決値・拒否理由・計測・出力失敗の隔離を検証する。

## 残る課題

出力の完了保証、フィルタリング、カテゴリごとの出力先、呼び出しを識別するIDは扱わない。次の第7回でrunId、第8回でoperationIdと属性抽出、第9回でPinoによる出力抑制を扱う。これらは第6回には含めない。記事はzenn-contentsで管理する。
