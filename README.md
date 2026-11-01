# ts-logging-lab

**TypeScriptで「既存の処理にログを付けたい」という小さな要求から、設計を段階的に発展させる全11回の教材です。**

高階関数、Proxy/Reflect、WeakMap、Adapter、実行文脈、属性抽出を順に学び、Pinoや診断ログへつなげます。Puppeteerを題材に、元の処理の型や振る舞いを保ちながらログを追加する設計を、コードとテストで確かめます。

## はじめに動かす

Node.js 26系を使用します。nvmを使う場合は、次の手順で依存を導入できます。npmはNode.jsに同梱されたものを使用でき、特定のバージョンへの切り替えは不要です。

```sh
git clone --branch rewrite-series https://github.com/winuim/ts-logging-lab.git
cd ts-logging-lab
nvm install
nvm use
npm ci
npm run example:part-01
```

`example:part-01`はビルド後に小さな非同期関数を実行し、開始・成功・失敗を構造化されたJSONとして出力します。ブラウザは不要です。

続けて、ブラウザを使わない次の例を試せます。

```sh
npm run example:part-08
npm run example:part-09
```

第8回の例では、同じ操作を並行実行し、`runId`・`operationId`と属性を確認します。第9回の例では、Pinoによる出力抑制とダミー属性のRedactionを確認します。ID、時刻、処理時間は実行ごとに変わります。

### Puppeteerを使う例

Chromeを起動できる環境で、ブラウザを準備してから実行します。

```sh
npm run browser:install
npm run example:part-03
npm run example:part-10
```

通常の`npm ci`ではブラウザをダウンロードしません。実行例は`about:blank`やローカルHTMLを使い、診断用の通信失敗は送信前のabortで発生させるため、外部サイトの応答に依存しません。

## 全11回の構成

各回のコードは`part-01`〜`part-11`タグで参照できます。順番に読むと、要求に合わせて責務を分けていく過程を追えます。

| 回  | 主題                        | 内容                                          | コード                                                           |
| --- | --------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| 01  | 高階関数とジェネリクス      | withLogによる最小のログ付与                   | [part-01](https://github.com/winuim/ts-logging-lab/tree/part-01) |
| 02  | Proxy・Reflect・this        | 実体を受け手にしたPageの転送                  | [part-02](https://github.com/winuim/ts-logging-lab/tree/part-02) |
| 03  | 戻り値とチェーンのProxy     | Browser/Page/Keyboard/Locatorへの拡張         | [part-03](https://github.com/winuim/ts-logging-lab/tree/part-03) |
| 04  | WeakMapと同一性             | Proxy・メソッドの再利用とunwrap               | [part-04](https://github.com/winuim/ts-logging-lab/tree/part-04) |
| 05  | 構造化イベントとAdapter     | OperationEvent・createEmitter・ConsoleAdapter | [part-05](https://github.com/winuim/ts-logging-lab/tree/part-05) |
| 06  | カテゴリとログレベル        | 呼び出し側の分類とフェーズ別レベル            | [part-06](https://github.com/winuim/ts-logging-lab/tree/part-06) |
| 07  | AsyncLocalStorageと実行文脈 | 一連の処理にrunIdを付与                       | [part-07](https://github.com/winuim/ts-logging-lab/tree/part-07) |
| 08  | 呼び出しIDと属性抽出        | operationIdとフェーズ別ContextExtractor       | [part-08](https://github.com/winuim/ts-logging-lab/tree/part-08) |
| 09  | Adapterと既存ロガー         | PinoによるフィルタとRedaction                 | [part-09](https://github.com/winuim/ts-logging-lab/tree/part-09) |
| 10  | 診断ログとイベント購読      | DiagnosticLoggerとPageの購読・解除            | [part-10](https://github.com/winuim/ts-logging-lab/tree/part-10) |
| 11  | 統合検証と設計の振り返り    | 第10回までの機能を組み合わせて検証            | [part-11](https://github.com/winuim/ts-logging-lab/tree/part-11) |

第11回は新機能を追加せずに全体を検証するため、`part-11`と`part-10`は同じ実装を参照します。[最終回の実行方法](docs/part-11.md)では、記事に掲載した統合例の動かし方と確認項目を説明しています。

### 各回のコードを試す

タグは、その回で説明する機能までを含むスナップショットです。対象のタグに切り替え、そのタグのREADMEと`.nvmrc`に従って実行します。

```sh
git checkout part-01
nvm install
nvm use
npm ci
npm run example:part-01
```

第1〜4回のタグはNode.js 24系、第5回以降は26系を指定しています。各回のAPI・出力・テストを調べるときは、同じタグ内のファイルを参照してください。

## 設計の全体像

```text
非同期操作 → withLog → createOperationLogger ─┐
                                            ├→ createEmitter → LogAdapter
Pageのイベント → createDiagnosticLogger ────┘                  ├→ ConsoleAdapter
                                                              └→ PinoAdapter → Pino
```

Proxyは既知のメソッドを`withLog`で包み、BrowserからPage、Keyboard、Locatorへラップを引き継ぎます。単独の関数には`withLog`を直接使えます。

| 部品                         | 担当すること                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| withLog                      | 元の非同期関数の実行、時間計測、成否の通知                          |
| Proxyとunwrap                | 実体をthisにした転送、戻り値のラップ、参照の同一性                  |
| createOperationLogger        | 呼び出しごとのoperationId、フェーズ別属性抽出、抽出失敗の隔離       |
| withRunContext               | 呼び出し側が指定したrunIdを非同期処理へ引き継ぐ                     |
| createDiagnosticLogger       | 操作の成否とは別の出来事を通知する                                  |
| subscribePageDiagnostics     | pageerror・requestfailedの購読と解除                                |
| createEmitter                | カテゴリ・レベル・固定メッセージ・現在のrunIdの付与、出力失敗の隔離 |
| ConsoleAdapter / PinoAdapter | 出力先固有の変換と出力                                              |

`createOperationLogger`は内部モジュールです。利用側のAPIは`src/index.ts`から公開し、ビルド後は`dist/index.js`から読み込めます。

### ログを読むときの区別

- `runId`は一連の実行、`operationId`は個々の呼び出しを識別します。Page IDや分散トレースのIDではありません。
- カテゴリとフェーズ別レベルは呼び出し側が指定し、Emitterが解決します。ConsoleAdapterは全レベルを出力し、Pinoはロガーの閾値で出力を抑制できます。
- ContextExtractorは必要な浅いプリミティブ属性だけを選びます。秘密値を自動判定するものではありません。PinoのRedactionは設定したパスをそのPino出力だけで保護します。
- 診断ログは`kind: 'diagnostic'`で判別し、操作のphase・operationId・durationMsを持ちません。Puppeteerのイベントと直前の操作の自動相関は保証しません。

## 保持する振る舞いと制約

- `withLog`は元関数の引数・this・解決値・拒否理由を保ちます。asyncラッパーのためPromise自体の同一性は保たず、同期throwはrejectになります。同期関数や任意のオーバーロードを完全に保持する汎用ラッパーではありません。
- Proxyは実体とは別のオブジェクトです。既知の子オブジェクトと戻り値だけを包み、同じ実体には最初の設定を使います。unwrapはトップレベルの引数だけに適用します。
- ProxyのPromise変換は現在のrealmのPromiseが対象です。任意のthenableや別realmのPromise、書き換え禁止かつ再定義禁止の関数プロパティを網羅しません。
- Adapterの同期throwと返されたPromiseのrejectは隔離しますが、ログの欠落、後から起きるストリーム障害、flushや配送完了までは保証しません。
- Pageの購読は同一対象への重複を防ぎます。所有者がfinallyで解除し、参照カウントやPageのclose時の自動解除には依存しません。
- OpenTelemetry連携、リソースID、任意スコープ、イベントカタログ、共通の自動マスキング、ベンチマークは実装範囲に含みません。

## 設計・検証を詳しく読む

- [第3回：戻り値とチェーン](docs/part-03.md)
- [第4回：WeakMapとunwrap](docs/part-04.md)
- [第6回：カテゴリとログレベル](docs/part-06.md)
- [第7回：AsyncLocalStorageと実行文脈](docs/part-07.md)
- [第8回：呼び出しIDと属性抽出](docs/part-08.md)
- [第9回：PinoAdapter](docs/part-09.md)
- [第10回：診断ログとイベント購読](docs/part-10.md)
- [第11回：統合検証と振り返り](docs/part-11.md)

## 開発と検証

```sh
npm run typecheck
npm test
npm run build
node dist/index.js
npm run lint
npm run format:check
```

単体テストは`tests/unit/`、Chromeを使う統合テストは`tests/integration/`に分けています。ブラウザの準備後、統合テストを実行できます。

```sh
npm run browser:install
npm run test:integration
```

検証やPRの運用ルールは[AGENTS.md](AGENTS.md)を参照してください。

### 主なコマンド

| コマンド                 | 用途                                             |
| ------------------------ | ------------------------------------------------ |
| npm run typecheck        | ソース・テスト・設定の型検査                     |
| npm test                 | ブラウザ不要の単体テストを一度実行               |
| npm run test:watch       | 単体テストの変更監視                             |
| npm run build            | src/をdist/へESM・型宣言・ソースマップとして出力 |
| node dist/index.js       | 公開APIの起動確認（出力なし）                    |
| npm run browser:install  | Puppeteerが指定するChromeを取得                  |
| npm run test:integration | 実Chromeによる統合テスト                         |
| npm run lint             | 型情報を使ったLint（警告も失敗扱い）             |
| npm run format:check     | 整形検査                                         |
| npm run format           | 整形を適用                                       |

### ディレクトリ構成

```text
src/                 教材の実装と公開API
examples/            ビルド済みコードを使う実行例
tests/unit/          ブラウザ不要の単体テスト
tests/integration/   実Chromeを使う統合テスト
docs/                各回の設計・検証・制約
```

NodeNextによるESMを使用し、相対importには`.js`拡張子を書きます。TypeScriptは`strict`に加え、`noUncheckedIndexedAccess`や`exactOptionalPropertyTypes`などを有効にしています。依存バージョンはpackage.jsonとpackage-lock.jsonで管理し、`npm ci`で再現します。

## 記事

全11回の記事は[zenn-contents](https://github.com/winuim/zenn-contents/tree/main/articles)で管理しています。

## ライセンス

`UNLICENSED`（利用許諾なし）です。
