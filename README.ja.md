# ts-logging-lab

[English](README.md) | 日本語

**TypeScriptで「既存の処理にログを付けたい」という小さな要求から、設計を段階的に発展させる教材リポジトリです。**

高階関数、Proxy/Reflect、WeakMap、Adapter、イベントカタログ、マスキング、OpenTelemetry連携などを、実際に動くコードとテストで学びます。Puppeteerはログを付与する対象の一例であり、ライブラリ自体の開発が目的ではありません。

> **ステータス：全12回を実装済み** — `main`は完成版です。各回の完成時点は`part-01`〜`part-12`タグで参照できます。コードと同梱ドキュメントには[MITライセンス](LICENSE)を適用します。

## 目的と対象読者

TypeScriptの関数・ジェネリクス、Promise/async/awaitの基本を理解し、既存コードにログを追加する設計を学びたい方を対象にしています。Puppeteerの詳しい知識は不要で、最初の実行例はブラウザなしで試せます。教材として設計の変化と制約を示すためのコードです。実サービスへ取り入れる場合は、各回の制約と自分のアプリの機密情報・障害時の要件を確認してください。

- 既存処理の振る舞いと型を維持しながら、横断的なログ処理を追加する
- 「何が起きたか」を表すイベントと、「どう出力するか」を分離する
- ログに残す情報・残さない情報を、操作の文脈から設計する
- 非同期処理や実オブジェクトの識別情報を、混同せず関連付ける
- ログ処理が本体の動作・安全性・性能に与える影響をテストする

## セットアップと最初の実行

Node.js **24.22.1**（24系LTS）とnpm **11.21.1**を使用します。nvmを使う場合は、次の手順でcloneしてから環境を準備してください。別のバージョン管理ツールでも同じバージョンを指定できます。

```sh
git clone https://github.com/winuim/ts-logging-lab.git
cd ts-logging-lab
nvm install
nvm use
npm install --global npm@11.21.1
npm ci
npm run example:part-01
```

`npm ci`はコミット済みの`package-lock.json`から依存を再現します。通常のインストールでは`.puppeteerrc.cjs`の`skipDownload: true`によりブラウザを取得しません。

最初の実行例はブラウザ不要です。開始・成功・失敗のログと、呼び出し側での例外処理を確認できます。`main`の実行例は完成版のAPIを使い、必要なLogTapeの設定も含めています。

### ブラウザを使う場合

Puppeteer **25.16.0**と、そのCLIが指定するChrome for Testingを使用します。ブラウザを起動できるローカル環境で、次を実行してください。

```sh
npm run browser:install
npm run example:part-02
```

ブラウザはPuppeteerのキャッシュへ取得します。実行例・統合テストは`about:blank`・`data:` URL・ローカルHTMLやローカルHTTPサーバーを使用します。

### 構成と採用環境

```text
src/                          教材実装（公開APIはsrc/index.ts）
examples/                     ビルド済みコードを使う小さな実行例
docs/                         全12回の実装・制約・動作差
benchmarks/                   性能計測スクリプトと参照実測結果
LICENSE                       コードと同梱ドキュメントのMITライセンス
tests/unit/                   ブラウザ不要の単体テスト
tests/integration/            実Pageによるprivate・操作・成功・失敗の統合テスト
vitest.config.ts              単体テストのみを収集
vitest.integration.config.ts  統合テストのみを収集
```

- Node.js 24系LTSとnpm 11系を採用し、`.nvmrc`と`packageManager`で検証バージョンを固定します。`engines`と`.npmrc`で異なるメジャーの利用を検出します。
- TypeScript **6.0.3**、Vitest **5.0.5**、ESLint **10.13.0**、`@eslint/js` **10.0.1**、typescript-eslint **8.72.1**、Prettier **3.9.10**、`@types/node` **24.19.2**を完全固定しています。間接依存はlockfileで固定します。TypeScriptはtypescript-eslintの対応範囲（`<6.1.0`）に合わせています。
- Node.jsでそのまま実行できるESM（`type: module`、`NodeNext`）を使い、相対importには`.js`拡張子を書きます。ビルドは`tsc`だけで行い、バンドラーや独自ランナーは追加しません。
- `strict`に加え、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、未使用・分岐の検査などを有効にします。テストと設定も型検査し、配布用ビルドには`src/`のみを含めます。
- ESLintは型情報を使う厳格なルールを採用し、`any`・非nullアサーション・型アサーションを禁止します。整形はPrettierに任せます。
- Puppeteerが必要なテストは`tests/integration/**/*.test.ts`に置きます。単体テストはこのディレクトリを収集しません。第2回で統合テストとローカルでのブラウザ準備を追加しました。空のテスト群を成功扱いにしません。
- Puppeteer **25.16.0**を開発依存として完全固定しました。Pageの型定義とevaluate内のDOM参照のため、tsconfigのlibにDOM・DOM.Iterableを加えています。型定義を追加しても、Node.js実行時にwindowやdocumentが生えるわけではありません。LogTapeは第5回で導入しました。OpenTelemetryは第10回でAPI **1.10.0**、SDK/context-async-hooks **3.0.0**を導入しました。

設定の根拠：[Node.jsリリース方針](https://github.com/nodejs/Release)、[TypeScript設定](https://www.typescriptlang.org/tsconfig/)、[Vitest導入ガイド](https://vitest.dev/guide/)。

## 全12回の一覧

各回の詳細ドキュメントは日本語です。説明のリンクから、各回で追加した仕組み・実行例・テスト・制約を確認できます。各回は前回の実装を基に段階的に積み上げています。

| 回  | 説明                                         | 主なAPI・コマンド                                | 完成タグ                                                           |
| --- | -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| 01  | [高階関数とジェネリクス](docs/part-01.md)    | `withLog`                                        | [`part-01`](https://github.com/winuim/ts-logging-lab/tree/part-01) |
| 02  | [Proxy・Reflect・this](docs/part-02.md)      | `withPageLogging`                                | [`part-02`](https://github.com/winuim/ts-logging-lab/tree/part-02) |
| 03  | [Proxyの共通化](docs/part-03.md)             | `createLoggingProxy`                             | [`part-03`](https://github.com/winuim/ts-logging-lab/tree/part-03) |
| 04  | [WeakMapと同一性](docs/part-04.md)           | `unwrap`                                         | [`part-04`](https://github.com/winuim/ts-logging-lab/tree/part-04) |
| 05  | [構造化イベントとAdapter](docs/part-05.md)   | `LogEvent` / `LogAdapter` / `LogTapeAdapter`     | [`part-05`](https://github.com/winuim/ts-logging-lab/tree/part-05) |
| 06  | [イベントカタログ](docs/part-06.md)          | `eventCatalog` / `parseLevelOverrides`           | [`part-06`](https://github.com/winuim/ts-logging-lab/tree/part-06) |
| 07  | [拡張可能なマスキング](docs/part-07.md)      | `createArgumentPolicy` / `createPuppeteerPolicy` | [`part-07`](https://github.com/winuim/ts-logging-lab/tree/part-07) |
| 08  | [型安全なフック](docs/part-08.md)            | `ContextExtractor` / `navigationContext`         | [`part-08`](https://github.com/winuim/ts-logging-lab/tree/part-08) |
| 09  | [リソース識別とWeakMap](docs/part-09.md)     | `ResourceContext`                                | [`part-09`](https://github.com/winuim/ts-logging-lab/tree/part-09) |
| 10  | [OpenTelemetryとのログ相関](docs/part-10.md) | `openTelemetryCorrelation`                       | [`part-10`](https://github.com/winuim/ts-logging-lab/tree/part-10) |
| 11  | [イベント購読と診断ログ](docs/part-11.md)    | `subscribeDiagnostics`                           | [`part-11`](https://github.com/winuim/ts-logging-lab/tree/part-11) |
| 12  | [品質検証](docs/part-12.md)                  | `npm run benchmark`                              | [`part-12`](https://github.com/winuim/ts-logging-lab/tree/part-12) |

### 各回の時点で学ぶ

`main`は完成版です。各回の実装を確認する場合は、作業ツリーに変更がない状態で対応タグへ切り替えます。たとえば第1回は次の手順で確認できます。

```sh
git switch --detach part-01
npm ci
npm run example:part-01
npm test
```

各タグのREADMEを、その時点のAPI・依存・実行コマンドの正として読んでください。第1回のタグにはLogTapeやPuppeteerは含まれません。実ブラウザが必要な回では、タグのREADMEに従ってChromeを準備します。

完成版へ戻るには`git switch main`を実行し、再度`npm ci`で依存を揃えます。既存タグは当時の記録として維持するため、古いREADMEやpackage.jsonには導入前のライセンス表記も残っています。

## 共通の設計方針と責務の境界

| この教材で設計・実装するもの                               | 既存ロガー（主にLogTape）に任せるもの                         |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| HOF/Proxyによる処理へのログ付与                            | ログレベルによる出力フィルタリング                            |
| LogEventとLogAdapter、出力先に依存しないイベント生成       | Sink/Formatter、NDJSONなどの形式                              |
| イベントID・カテゴリ・既定レベル・固定メッセージのカタログ | 出力先、ファイル管理、ローテーション                          |
| イベントごとの**割り当てレベル**の上書き                   | 必要に応じた非同期出力・バッファリング                        |
| 操作の文脈に応じたマスキングと安全な属性抽出               | 汎用的なロギング機能                                          |
| OpenTelemetryからの相関情報取得・ログへの付与              | traceId/spanId生成、Span管理・コンテキスト伝播はOpenTelemetry |
| WeakMapによるアプリ固有のリソース識別                      | ログ基盤の運用機構                                            |

**区別：** イベントに`info`/`error`等のレベルを「付ける」のはアプリ側。そのレベルを「出す／出さない」と判定するのはロガー側です。

この教材はロギングライブラリもトレーシングSDKも再実装しません。LogEvent/LogAdapterの契約は**特定のロガーに依存させず**、教材の具体的な出力アダプタは**LogTapeAdapterの1種類のみ**を実装します。Pinoなど別ロガーは交換可能な設計の説明にとどめ、教材内で複数アダプタを実装しません。LogTapeのAPIや設定をアプリ側のイベント契約に漏らさないことを重視します。

ログ付与によって本体の戻り値や拒否理由を変えず、必要な範囲で出力障害を隔離します。ログの欠落や出力完了の扱い、Promise・Proxyの同一性など、保証する範囲と制約は各回の説明で確認してください。

機密情報は既定で安全側に扱い、生の引数・戻り値・例外を無条件には出力しません。操作名・追加ルール・フックも含めて、安全に残せる属性をアプリ側で選びます。カスタム処理の信頼境界は[第7回](docs/part-07.md)と[第8回](docs/part-08.md)を参照してください。

traceId/spanIdの生成、Spanの親子管理、非同期コンテキスト伝播はOpenTelemetryの標準API/SDKに任せます。教材の連携は、有効なアクティブSpanContextの参照とログ属性への付与に限定します。WeakMapによるリソース識別は、非同期処理の文脈とは別の責務です。

## 検証方法

ブラウザ不要の通常の検証は、次の順に実行します。

```sh
npm run typecheck
npm test
npm run build
node dist/index.js
npm run lint
npm run format:check
```

GitHub Actionsは課金しない方針のため使用せず、検証はローカルで実行してPRに結果を記録します。

### 共通コマンド

| コマンド                         | 用途                                                            |
| -------------------------------- | --------------------------------------------------------------- |
| `npm run typecheck`              | ソース・テスト・Vitest設定の型チェック                          |
| `npm test` / `npm run test:unit` | ブラウザ不要の単体テストを一度実行                              |
| `npm run test:watch`             | 単体テストの変更監視                                            |
| `npm run build`                  | `src/`を`dist/`へESM・型宣言・ソースマップとして出力            |
| `node dist/index.js`             | ビルド済みエントリーポイントの起動確認（API公開のみ・出力なし） |
| `npm run lint`                   | 型情報を使ったESLint検査（警告も失敗扱い）                      |
| `npm run format:check`           | Prettierの整形検査                                              |
| `npm run format`                 | Prettierで整形                                                  |

### 統合テストと性能計測

単体テストは`tests/unit/`、実Chromeを使う統合テストは`tests/integration/`に分けています。ブラウザを使う実装を変更した場合は、次も実行します。

```sh
npm run browser:install
npm run test:integration
npm run example:part-02
```

横断テストと性能計測の条件・実測値・制約は[第12回](docs/part-12.md)、計測の生データは[reference.json](benchmarks/results/reference.json)を参照してください。性能計測は次のコマンドで実行できます。

```sh
npm run benchmark -- /private/tmp/ts-logging-benchmark.json
```

## ライセンス

本リポジトリのコードと同梱ドキュメントは[MITライセンス](LICENSE)で提供します。著作権表示とライセンス表示を保持することを条件に、商用利用・改変・再配布が可能です。無保証で提供します。

Puppeteer、LogTape、OpenTelemetryなどの第三者依存には、それぞれのライセンスが適用されます。

`package.json`の`private: true`はnpmへの誤公開を防ぐ設定です。GitHubリポジトリの公開範囲やMITライセンスとは独立しているため、そのまま維持します。
