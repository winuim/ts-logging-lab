# ts-logging-lab

**TypeScriptで「既存の処理にログを付けたい」という小さな要求から、設計を段階的に発展させる教材リポジトリです。**

高階関数、Proxy/Reflect、WeakMap、Adapter、イベントカタログ、マスキング、OpenTelemetry連携などを、実際に動くコードとテストで学びます。Puppeteerはログを付与する対象の一例であり、ライブラリ自体の開発が目的ではありません。

> **ステータス：開発基盤のみ整備** — 型チェック・単体テスト・ビルド・Lintをローカルで実行できます。全12回の機能と各回のタグは未実装です。ロードマップは実装完了を意味しません。

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

| コマンド                         | 用途                                                                 |
| -------------------------------- | -------------------------------------------------------------------- |
| `npm run typecheck`              | ソース・テスト・Vitest設定の型チェック                               |
| `npm test` / `npm run test:unit` | ブラウザ不要の単体テストを一度実行                                   |
| `npm run test:watch`             | 単体テストの変更監視                                                 |
| `npm run build`                  | `src/`を`dist/`へESM・型宣言・ソースマップとして出力                 |
| `node dist/index.js`             | ビルド済みエントリーポイントの起動確認（現時点では出力なし）         |
| `npm run lint`                   | 型情報を使ったESLint検査（警告も失敗扱い）                           |
| `npm run format:check`           | Prettierの整形検査                                                   |
| `npm run format`                 | Prettierで整形                                                       |
| `npm run test:integration`       | 将来のPuppeteer統合テスト専用（現在はテスト未追加のため終了コード1） |

通常の検証は`npm run typecheck`、`npm test`、`npm run build`、`node dist/index.js`、`npm run lint`、`npm run format:check`の順に実行します。GitHub Actionsは課金しない方針のため使用せず、ワークフローは配置しません。PR前にローカルでこれらの検証を実行し、結果をPRに記録します。

### 構成と設計判断

```text
src/                          教材実装（現在は空のindex.tsのみ）
tests/unit/                   ブラウザ不要の単体テスト
tests/integration/            実ブラウザを使う統合テストの追加先
vitest.config.ts              単体テストのみを収集
vitest.integration.config.ts  統合テストのみを収集
```

- Node.js 24系LTSとnpm 11系を採用し、`.nvmrc`と`packageManager`で検証バージョンを固定します。`engines`と`.npmrc`で異なるメジャーの利用を検出します。
- TypeScript **6.0.3**、Vitest **5.0.5**、ESLint **10.13.0**、`@eslint/js` **10.0.1**、typescript-eslint **8.72.1**、Prettier **3.9.10**、`@types/node` **24.19.2**を完全固定しています。間接依存はlockfileで固定します。TypeScriptはtypescript-eslintの対応範囲（`<6.1.0`）に合わせています。
- Node.jsでそのまま実行できるESM（`type: module`、`NodeNext`）を使い、相対importには`.js`拡張子を書きます。ビルドは`tsc`だけで行い、バンドラーや独自ランナーは追加しません。
- `strict`に加え、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、未使用・分岐の検査などを有効にします。テストと設定も型検査し、配布用ビルドには`src/`のみを含めます。
- ESLintは型情報を使う厳格なルールを採用し、`any`・非nullアサーション・型アサーションを禁止します。整形はPrettierに任せます。
- Puppeteerが必要なテストは`tests/integration/**/*.test.ts`に置きます。単体テストはこのディレクトリを収集しません。統合テスト・ローカルでのブラウザ準備は実ブラウザを扱う回で追加します。空のテスト群を成功扱いにしません。
- Puppeteer・LogTape・OpenTelemetryは、それぞれを使う回でバージョンと最小限の依存を決定します。現時点では導入せず、HOF・Proxy・Adapter等の教材APIも先取りしません。
- 初期テストは空のエントリーポイントのESM読み込みを確認するものです。第1回でAPIを追加するときに、その回の振る舞いと型のテストへ更新します。

設定の根拠：[Node.jsリリース方針](https://github.com/nodejs/Release)、[TypeScript設定](https://www.typescriptlang.org/tsconfig/)、[Vitest導入ガイド](https://vitest.dev/guide/)。

READMEはセットアップ・設計判断・ロードマップを、AGENTS.mdは開発時の運用ルールを担当します。記事に対応する教材API・`part-XX`タグはまだなく、Zenn草稿の更新・公開は今回の対象外です。各回の実装時にコード・API・記事を照合します。

## 関連

- 既存の実験的実装：[puppeteer-hof-logging](https://github.com/winuim/puppeteer-hof-logging)（教材の完成版と同一ではありません）
- 記事草稿：[zenn-contents](https://github.com/winuim/zenn-contents)（現在の下書きは新構成に合わせて再編集予定）

## ライセンス

`UNLICENSED`（利用許諾なし）とし、`private: true`でnpmへの誤公開を防ぎます。現在のPrivate運用を維持し、オープンソースライセンスや公開範囲は公開を判断する際に別途決定します。
