# ts-logging-lab

**TypeScriptで「既存の処理にログを付けたい」という小さな要求から、設計を段階的に発展させる教材リポジトリです。**

高階関数、Proxy/Reflect、WeakMap、Adapter、イベントカタログ、マスキング、OpenTelemetry連携などを、実際に動くコードとテストで学びます。Puppeteerはログを付与する対象の一例であり、ライブラリ自体の開発が目的ではありません。

> **ステータス：第6回まで実装** — `withLog`と、実Pageの`goto`をログ化する`withPageLogging`、単体・実ブラウザのテストと実行例を用意しています。第7回以降の機能は未実装です。各回のタグはレビュー・マージ完了後に作成します。ロードマップ全体の実装完了を意味しません。

## このプロジェクトで学ぶこと

- 既存処理の振る舞いと型を維持しながら、横断的なログ処理を追加する
- 「何が起きたか」を表すイベントと、「どう出力するか」を分離する
- ログに残す情報・残さない情報を、操作の文脈から設計する
- 非同期処理や実オブジェクトの識別情報を、混同せず関連付ける
- ログ処理が本体の動作・安全性・性能に与える影響をテストする

## 責務の境界

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

## 全12回のロードマップ

各回のタイトルは仮題です。Issueで詳細化し、実装と記事を照合して確定します。

| 回  | 主題                      | 追加する仕組み                                                               | 完了時の予定タグ |
| --- | ------------------------- | ---------------------------------------------------------------------------- | ---------------- |
| 01  | 高階関数とジェネリクス    | `withLog` による最小のログ付与                                               | `part-01`        |
| 02  | Proxy・Reflect・this      | インスタンスを安全にラップする                                               | `part-02`        |
| 03  | Proxyの共通化             | 複数のオブジェクト／戻り値への拡張                                           | `part-03`        |
| 04  | WeakMapと同一性           | `unwrap`、Proxy管理、イベントとの共存                                        | `part-04`        |
| 05  | 構造化イベントとAdapter   | ロガー非依存の`LogEvent`・`LogAdapter`と単一の`LogTapeAdapter`               | `part-05`        |
| 06  | イベントカタログ          | ID・カテゴリ・既定レベル・固定メッセージ、レベル上書き                       | `part-06`        |
| 07  | 拡張可能なマスキング      | 操作別ルール、既定の安全方針、テスト                                         | `part-07`        |
| 08  | 型安全なフック            | ContextExtractorで操作前後・失敗時の安全な属性を抽出                         | `part-08`        |
| 09  | リソース識別とWeakMap     | Browser/Page等の識別情報の関連付け                                           | `part-09`        |
| 10  | OpenTelemetryとのログ相関 | アクティブSpanのtraceId/spanIdを取得してLogEventに付与（独自生成・伝播なし） | `part-10`        |
| 11  | イベント購読と診断ログ    | HTTP/console/ページ例外等の診断イベントと購読解除                            | `part-11`        |
| 12  | 品質検証                  | 正常・異常・秘匿・並列・性能のテストと計測                                   | `part-12`        |

各回は前回の実装を基に**段階的に積み上げます**。完成版の機能を序盤のタグへ先取りせず、読者が変化を追えるようにします。

## 第1回：高階関数とジェネリクス

`src/index.ts`から`withLog(operation, fn)`を公開します。操作名は秘密情報を含まない固定文字列にしてください。

```ts
import { withLog } from './src/index.js';

const greet = withLog('greet', (name: string) =>
  Promise.resolve(`Hello, ${name}!`),
);
const message = await greet('TypeScript'); // Promise<string>、messageはstring
```

`Args`で引数のタプル、`Result`でPromiseの解決値、`This`で呼び出し時の`this`を受け取り、通常の関数を返す高階関数です。引数・結果・拒否理由のオブジェクトはコピーせず渡します。開始を出力してから元関数を一度呼び、成功または失敗を出力します。`performance.now()`で開始ログの後から元処理の完了までを計測し、終端ログにミリ秒で表示します。

```sh
npm run example:part-01
```

このコマンドはビルド後に`examples/part-01.mjs`を実行します。開始・成功・失敗と処理時間を実際に出力し、失敗は呼び出し側で処理します。ブラウザや追加依存は不要です。計測値は実行環境によって変わります。

### 保持する振る舞いと現在の制約

- 対象は`Promise`を返す関数です。引数の必須・省略可能・可変長の型、戻り値の型、明示された`this`型を保持します。元処理の解決値・拒否理由はそのまま返します。
- ラッパーは`async`関数のため、返すPromise自体の同一性は保持しません。Promiseを返す型の関数が同期的にthrowした場合も、同じ理由でrejectするPromiseになります。同期関数・コンストラクター・オーバーロードやジェネリック関数の呼び出しごとの型相関の完全保持は今回の対象外です。
- メソッドを渡しても元インスタンスへ自動bindしません。ラッパーを同じオブジェクトのメソッドとして使うか、`.call(receiver, ...)`で`this`を渡します。自動的なインスタンスのラップは第2回以降で扱います。
- 出力は最小の`console.info`呼び出しです。引数・戻り値・生の例外を出力しません。出力が同期的にthrowしても本体の成功・失敗を変えず、ログの欠落を許容します。プロセス終了や非同期の出力障害を回復する仕組みはありません。
- 第1回のタグにはAdapter・イベントカタログ・ロギング基盤・Puppeteer連携は含まれていません。同じ操作名の並行ログを識別するIDもまだありません。各呼び出しの計測値は独立しています。

## 第2回：Proxy・Reflect・thisとprivate

`withPageLogging(page)`で実PageをProxy化します。ログ対象は`goto`だけです。`goto`は第1回の`withLog`で包み、開始・成功・失敗・処理時間を出力します。URL・引数・応答・生のエラーはログに含めません。

```ts
import type { Page } from 'puppeteer';
import { withPageLogging } from './src/index.js';

export async function navigate(raw: Page) {
  const page = withPageLogging(raw);
  const response = await page.goto('about:blank'); // HTTPResponse | null
  const keyboard = page.keyboard; // getterのthisも実Page
  const value = await page.evaluate(() => 6 * 7); // 対象外メソッドも動く
  return { response, keyboard, value };
}
```

`Reflect.get(target, property, target)`でgetterのreceiverを実体へ固定し、ログ対象外も含め関数値を実体へbindして返します。setterも`Reflect.set(target, property, value, target)`で実体を使います。これにより`#private`やnative内部スロットがProxyを実体と取り違える問題を避けます。

### 今回の境界

- 直接の呼び出し結果・拒否理由は同じ値を返します。ログ対象の`goto`には第1回と同じasyncラッパーの制約があり、Promise自体の同一性や同期throwの境界は保ちません。対象外メソッドにはasyncラッパーを付けないため、同期throwは同期throwのままです。
- `withPageLogging<T extends Pick<Page, 'goto'>>(page: T): T`はPage専用の小さな構造契約です。単体テストでは同じ契約を持つfixtureを使い、統合テストでは実Pageを使います。汎用のメソッド登録・型アサーション・共通Proxy基盤は追加しません。
- キーボードなどの子オブジェクト・メソッドの戻り値は再ラップしません。`this`を返すメソッドも実体を返すので、その先のチェーンはProxyを通りません。第3回以降の検討対象です。
- Proxyは元インスタンスとは別物です。メソッドは取得ごとにbindされるため関数の同一性を保たず、constructor等の関数値もbind対象になります。二重ラップ防止・キャッシュ・`unwrap`は未実装です。
- 対象は通常の未改変のPageです。書き換え禁止かつ再定義禁止の独自関数プロパティはProxyの不変条件により差し替えられず、適用対象外です。Proxyを完全に透明にする設計ではありません。

### ブラウザを使う検証

```sh
npm run browser:install
npm run test:integration
npm run example:part-02
```

Puppeteer **25.16.0**と、そのCLIが指定するChrome for Testingを使用します。`browser:install`はブラウザをPuppeteerのキャッシュへ取得します。ブラウザを起動できるローカル環境で実行してください。実行例・テストは`about:blank`・`data:` URL・ローカルHTMLを使い、外部Webサイトへアクセスしません。

通常の`npm ci`では`.puppeteerrc.cjs`の`skipDownload: true`でブラウザを取得しません。ブラウザなしの単体テストと、実ブラウザの統合テストは引き続き分離しています。GitHub Actionsは使用しません。

## イベントカタログの方針（第6回）

カタログには`eventId`、`category`、`defaultLevel`、固定`message`を定義します。操作名・所要時間・traceId等の値は実行時属性として別に渡します。

- カタログを`as const`/`satisfies`等で型安全に定義する
- イベントIDによるレベル上書きをアプリ側で解決する
- **レベルによる出力の間引き**はLogTapeに任せる
- メッセージテンプレートエンジンは作らず、まずは固定文言＋構造化属性で扱う

## LogAdapterの方針（第5回）

`LogEvent`と`LogAdapter`はロガーに依存しない小さな契約とし、具体的な接続実装は`LogTapeAdapter`だけを用意します。LogTapeはフィルタリング、整形、Sink、出力先を担当します。Pinoなどへの差し替えは可能性として説明しますが、教材に別のアダプタは追加しません。

## OpenTelemetry連携の方針（第10回）

**OpenTelemetryの標準API/SDKにtraceId・spanIdの生成、Spanの親子管理、非同期コンテキスト伝播を任せます。** 自前の`AsyncLocalStorage`ベースのContextManagerやトレースID生成器は作りません。第10回ではアクティブSpanから有効なSpanContextを取得し、ログの構造化属性に安全に付与する**薄い連携部分**を実装・テストします。Spanがない場合を許容し、Pino/LogTape固有の機能に依存しない形にします。教材の主題はOpenTelemetry SDKの再実装でも、全機能の解説でもありません。

## マスキングの方針（第7回）

特定のロガーが提供するRedaction機能を前提とせず、**操作の意味に合わせてログ化前に安全な値を選ぶ**方法を扱います。判定材料がない入力値は既定で秘匿する方向とし、追加ルールを登録できる設計を実際に実装・テストします。例外やカスタムフックからの情報流出も検証対象とします。

## 開発と記事の対応

1. README/AGENTS.mdに方針を定義する。
2. 全12回をIssueに起こし、依存順に実装する。
3. IssueごとにブランチとPRを作成し、テスト・レビュー後に`main`へマージする。
4. 各回の完了コミットに`part-01`〜`part-12`タグを付ける（実装完了前に作らない）。
5. Zenn記事は対応タグを参照し、記載する実装例・API・実行結果を確認する。

記事にはその回のタグに存在しない機能を「実装済み」として載せません。発展案は明確に区別します。Puppeteerを記事の主役にはせず、**TypeScriptの設計上の課題と解決策**を主題にします。

## セットアップ

Node.js **24.22.1**（24系LTS）とnpm **11.21.1**を使用します。nvmを使う場合は次の手順で準備できます。別のバージョン管理ツールでも同じバージョンを指定してください。

```sh
nvm install
nvm use
npm install --global npm@11.21.1
npm ci
```

`npm ci`はコミット済みの`package-lock.json`から依存を再現します。ブラウザのダウンロードは発生しません。

### 実行コマンド

| コマンド                         | 用途                                                            |
| -------------------------------- | --------------------------------------------------------------- |
| `npm run typecheck`              | ソース・テスト・Vitest設定の型チェック                          |
| `npm test` / `npm run test:unit` | ブラウザ不要の単体テストを一度実行                              |
| `npm run test:watch`             | 単体テストの変更監視                                            |
| `npm run build`                  | `src/`を`dist/`へESM・型宣言・ソースマップとして出力            |
| `node dist/index.js`             | ビルド済みエントリーポイントの起動確認（API公開のみ・出力なし） |
| `npm run example:part-01`        | 第1回の成功・失敗の実行例                                       |
| `npm run browser:install`        | Puppeteerが指定するChromeを取得                                 |
| `npm run example:part-02`        | 実Pageをラップする第2回の実行例                                 |
| `npm run lint`                   | 型情報を使ったESLint検査（警告も失敗扱い）                      |
| `npm run format:check`           | Prettierの整形検査                                              |
| `npm run format`                 | Prettierで整形                                                  |
| `npm run test:integration`       | 実Pageによる統合テスト（事前にbrowser:installが必要）           |

通常の検証は`npm run typecheck`、`npm test`、`npm run build`、`node dist/index.js`、`npm run lint`、`npm run format:check`の順に実行します。GitHub Actionsは課金しない方針のため使用せず、ワークフローは配置しません。PR前にローカルでこれらの検証を実行し、結果をPRに記録します。

### 構成と設計判断

```text
src/                          教材実装（withLog・withPageLoggingを公開）
examples/                     ビルド済みコードを使う小さな実行例
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
- Puppeteer **25.16.0**を開発依存として完全固定しました。Pageの型定義とevaluate内のDOM参照のため、tsconfigのlibにDOM・DOM.Iterableを加えています。型定義を追加しても、Node.js実行時にwindowやdocumentが生えるわけではありません。LogTapeは第5回で導入しました。OpenTelemetryは導入回で決定します。
- 第1回のテストはESM公開API経由で、成功・失敗・同期throw・引数と結果の同一性・`this`・並行計測・出力失敗を検証します。型テストの正しい呼び出しと`@ts-expect-error`による不正な呼び出しも`npm run typecheck`で確認します。

設定の根拠：[Node.jsリリース方針](https://github.com/nodejs/Release)、[TypeScript設定](https://www.typescriptlang.org/tsconfig/)、[Vitest導入ガイド](https://vitest.dev/guide/)。

READMEはセットアップ・設計判断・ロードマップを、AGENTS.mdは開発時の運用ルールを担当します。各回の実行例は公開APIを直接使い、テストと合わせて動作確認します。Zennの[第1回草稿](https://github.com/winuim/zenn-contents/blob/main/articles/ts-logging-lab-part-01.md)は`part-01`に対応します。[第2回草稿](https://github.com/winuim/zenn-contents/blob/main/articles/ts-logging-lab-part-02.md)も今回の実装と照合して別PRで追加します。記事は`published: false`を維持し、対応タグは実装のレビュー・マージ完了後に作成します。

## 関連

- 既存の実験的実装：[puppeteer-hof-logging](https://github.com/winuim/puppeteer-hof-logging)（教材の完成版と同一ではありません）
- 記事草稿：[zenn-contents](https://github.com/winuim/zenn-contents)（現在の下書きは新構成に合わせて再編集予定）

## ライセンス

`UNLICENSED`（利用許諾なし）とし、`private: true`でnpmへの誤公開を防ぎます。現在のPrivate運用を維持し、オープンソースライセンスや公開範囲は公開を判断する際に別途決定します。

## 第3回の追加

Browser・Page・Keyboard・Locatorと戻り値を共通のProxyで扱います。[設計と動作差](docs/part-03.md)を参照してください。実行例は`npm run example:part-03`です。第2回の節は`part-02`時点の説明であり、現在は子オブジェクトとthisチェーンもラップします。

## 第4回の追加

WeakMapでProxyと実体を対応付け、二重ラップとメソッド参照を安定させます。`unwrap(value)`で登録済みProxyを実体へ戻せます。[設定の優先・寿命・イベント参照の方針](docs/part-04.md)を参照してください。同じ実体は最初の設定を採用します。

## 第5回の追加

ログ生成をロガー非依存の`LogEvent`/`LogAdapter`へ分け、唯一の具体的出力として`LogTapeAdapter`を追加しました。[契約・障害隔離・flushの境界](docs/part-05.md)を参照してください。`withLog`やProxyのoptionsへ`{ adapter }`を指定できます。省略時もLogTapeを使うため、呼び出し側で`configure`を行います。実行例にはその設定を追加済みです。LogTape 2.4.2を固定し、フィルタ・Sink・整形はLogTapeに任せます。

## 第6回の追加

`eventCatalog`と`createLogEvent`でID・カテゴリ・既定レベル・固定メッセージを統一します。`levelOverrides`でID別の割り当てを上書きでき、外部設定は`parseLevelOverrides`で検証します。[型・設定・フィルタの責務](docs/part-06.md)を参照してください。出力可否と整形は引き続きLogTapeが担当します。
