# ts-logging-lab

**TypeScriptで「既存の処理にログを付けたい」という小さな要求から、設計を段階的に発展させる全11回の教材です。**

高階関数、Proxy/Reflect、WeakMap、Adapter、実行文脈、属性抽出を順に学び、Pinoや診断ログへつなげます。Puppeteerを題材に、元の処理の型や振る舞いを保ちながらログを追加する設計を、コードとテストで確かめます。

## このREADMEについて

このREADMEは全11回に共通する案内です。構成と設計の説明はシリーズ完成時の全体像を示しています。各コミットには、その回までの実装が含まれます。

各回の実行例・追加の準備・対応するコードの参照先は記事で案内します。後続回で登場するAPIやコマンドが、前の回でも使えるとは限りません。

## セットアップ

第1回からNode.js 26系を使用します。npmはNode.jsに同梱されたものを使用でき、特定のバージョンへの切り替えは不要です。

```sh
git clone https://github.com/winuim/ts-logging-lab.git
cd ts-logging-lab
```

この手順ではデフォルトブランチの最新コミットを取得します。各回を学ぶときは、記事で案内するコミットに切り替えてから依存を導入してください。

nvmを使う場合は、次の手順でNode.jsを選び、lockfileから依存を再現できます。ほかのバージョン管理ツールでもNode.js 26系を指定できます。

```sh
nvm install
nvm use
npm ci
```

## 全11回の構成

順番に読むと、要求に合わせて責務を分けていく過程を追えます。

| 回  | 主題                        | 内容                                          |
| --- | --------------------------- | --------------------------------------------- |
| 01  | 高階関数とジェネリクス      | withLogによる最小のログ付与                   |
| 02  | Proxy・Reflect・this        | 実体を受け手にしたPageの転送                  |
| 03  | 戻り値とチェーンのProxy     | Browser/Page/Keyboard/Locatorへの拡張         |
| 04  | WeakMapと同一性             | Proxy・メソッドの再利用とunwrap               |
| 05  | 構造化イベントとAdapter     | OperationEvent・createEmitter・ConsoleAdapter |
| 06  | カテゴリとログレベル        | 呼び出し側の分類とフェーズ別レベル            |
| 07  | AsyncLocalStorageと実行文脈 | 一連の処理にrunIdを付与                       |
| 08  | 呼び出しIDと属性抽出        | operationIdとフェーズ別ContextExtractor       |
| 09  | Adapterと既存ロガー         | PinoによるフィルタとRedaction                 |
| 10  | 診断ログとイベント購読      | DiagnosticLoggerとPageの購読・解除            |
| 11  | 統合検証と設計の振り返り    | 第10回までの機能を組み合わせて検証            |

第11回は新機能を追加せずに、第10回までの機能を組み合わせて全体を検証します。

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

## 開発と検証

```sh
npm run typecheck
npm test
npm run build
node dist/index.js
npm run lint
npm run format:check
```

`npm test`はブラウザ不要の単体テストを実行します。実ブラウザを使う統合テストの準備と実行方法は、導入する回の記事で案内します。

### 主なコマンド

| コマンド             | 用途                                             |
| -------------------- | ------------------------------------------------ |
| npm run typecheck    | ソース・テスト・設定の型検査                     |
| npm test             | ブラウザ不要の単体テストを一度実行               |
| npm run test:watch   | 単体テストの変更監視                             |
| npm run build        | src/をdist/へESM・型宣言・ソースマップとして出力 |
| node dist/index.js   | 公開APIの起動確認（出力なし）                    |
| npm run lint         | 型情報を使ったLint（警告も失敗扱い）             |
| npm run format:check | 整形検査                                         |
| npm run format       | 整形を適用                                       |

### 主なディレクトリ

必要なファイルは各回で段階的に追加します。

```text
src/                 教材の実装と公開API
examples/            ビルド済みコードを使う実行例
tests/unit/          ブラウザ不要の単体テスト
```

NodeNextによるESMを使用し、相対importには`.js`拡張子を書きます。TypeScriptは`strict`に加え、`noUncheckedIndexedAccess`や`exactOptionalPropertyTypes`などを有効にしています。依存バージョンはpackage.jsonとpackage-lock.jsonで管理し、`npm ci`で再現します。

## ライセンス

[MIT License](LICENSE)です。
