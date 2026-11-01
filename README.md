# ts-logging-lab

**TypeScriptで「既存の処理にログを付けたい」という小さな要求から、設計を段階的に発展させる教材リポジトリです。**

高階関数、Proxy/Reflect、WeakMap、Adapter、カテゴリとログレベル、runId・operationId、属性抽出、Pino、診断ログを、実際に動くコードとテストで学びます。Puppeteerはログを付与する対象の一例であり、ライブラリ自体の開発が目的ではありません。

## このプロジェクトで学ぶこと

- 既存処理の振る舞いと型を維持しながら、横断的なログ処理を追加する
- 「何が起きたか」を表すイベントと、「どう出力するか」を分離する
- ログに残す情報・残さない情報を、操作の文脈から設計する
- 実行のrunId、呼び出しのoperationId、Proxyと実体の同一性を区別する
- ログ処理が本体の動作・安全性・性能に与える影響をテストする

## 責務の境界

| この教材で実装・利用するもの                          | 全11回の実装範囲に含めないもの                       |
| ----------------------------------------------------- | ---------------------------------------------------- |
| HOF/Proxyによるログ付与と戻り値のラップ（第1〜3回）   | 任意のオブジェクトを完全に透明にするProxy            |
| WeakMapによるProxyの再利用とunwrap（第4回）           | ログに出すPage等のリソースID                         |
| 操作イベント・Emitter・ConsoleAdapter（第5回）        | 高度なSink/Formatter、ローテーション、出力基盤の自作 |
| カテゴリ・フェーズ別レベル（第6回）                   | カテゴリ別の自動設定、イベントカタログ               |
| ALSによるアプリ内runId文脈（第7回）                   | 通信先への文脈伝播、独自ContextManager               |
| 呼び出し単位のoperationIdと安全な属性の選択（第8回）  | 親子ID、共通の自動マスキング、非同期Extractor        |
| PinoAdapterとPinoのフィルタ・Redaction（第9回）       | 独自フィルタ・Redactionエンジン、flush・配送完了保証 |
| 診断ログとPageのpageerror/requestfailed購読（第10回） | 診断の網羅、Puppeteerイベントと操作の自動相関        |
| 既存機能の統合検証と責務の振り返り（第11回）          | OpenTelemetry連携、traceId/spanIdやSpanの独自管理    |

**区別：** イベントに`info`/`error`等のレベルを「付ける」のはイベント生成側。第5回の`ConsoleAdapter`はレベルに応じてconsoleメソッドを振り分けますが、出力フィルタリングはしません。

この教材はロギングライブラリもトレーシングSDKも再実装しません。第5回の`LogEvent`/`LogAdapter`は**特定のロガーに依存させず**、具体的な出力先は`ConsoleAdapter`です。`debug`/`info`はstdout、`warning`/`error`はstderrへJSONを1行ずつ書きます。

## 全11回の構成と対応タグ

各回は前回の実装を基に段階的に積み上げます。後の回の機能を前の回のタグへ先取りしません。第11回で連載を終え、第12回は設けません。

| 回  | 主題                        | 内容                                              | タグ                                                               | 実装コミット |
| --- | --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ | ------------ |
| 01  | 高階関数とジェネリクス      | withLogによる最小のログ付与                       | [`part-01`](https://github.com/winuim/ts-logging-lab/tree/part-01) | `3d388c6`    |
| 02  | Proxy・Reflect・this        | 実体を受け手にしたPageの転送                      | [`part-02`](https://github.com/winuim/ts-logging-lab/tree/part-02) | `e07b63d`    |
| 03  | 戻り値とチェーンのProxy     | Browser/Page/Keyboard/Locatorへの拡張             | [`part-03`](https://github.com/winuim/ts-logging-lab/tree/part-03) | `cf24f74`    |
| 04  | WeakMapと同一性             | Proxy・メソッドの再利用とunwrap                   | [`part-04`](https://github.com/winuim/ts-logging-lab/tree/part-04) | `71ab011`    |
| 05  | 構造化イベントとAdapter     | OperationEvent・createEmitter・ConsoleAdapter     | [`part-05`](https://github.com/winuim/ts-logging-lab/tree/part-05) | `23d179f`    |
| 06  | カテゴリとログレベル        | 呼び出し側の分類とフェーズ別レベル                | [`part-06`](https://github.com/winuim/ts-logging-lab/tree/part-06) | `7d6f551`    |
| 07  | AsyncLocalStorageと実行文脈 | 呼び出し側が指定したrunIdをイベント生成時に付与   | [`part-07`](https://github.com/winuim/ts-logging-lab/tree/part-07) | `fccc6c2`    |
| 08  | 呼び出しIDと属性抽出        | operationIdとフェーズ別ContextExtractor           | [`part-08`](https://github.com/winuim/ts-logging-lab/tree/part-08) | `43cf717`    |
| 09  | Adapterと既存ロガー         | PinoAdapterからPinoのフィルタ・Redactionを利用    | [`part-09`](https://github.com/winuim/ts-logging-lab/tree/part-09) | `4065230`    |
| 10  | 診断ログとイベント購読      | DiagnosticLogger、共通LogRecord、Pageの購読・解除 | [`part-10`](https://github.com/winuim/ts-logging-lab/tree/part-10) | `2b23935`    |
| 11  | 統合検証と設計の振り返り    | 第10回までの既存APIを組み合わせる。新機能なし     | [`part-11`](https://github.com/winuim/ts-logging-lab/tree/part-11) | `2b23935`    |

2026-11-01にユーザーの明示指示で旧タグを削除し、上記の`part-01`〜`part-11`へ再設定しました。旧構成の`part-12`は削除済みです。第1〜4回の実装コミットは従来と同じで、第5〜10回は改訂済みの各回コミットです。`part-11`は`part-10`と同じ`2b23935`を指します。

各タグはその段階の実装スナップショットです。今回の構成・タグ説明を反映した最新ドキュメントは`rewrite-series`側を参照してください。タグの参照先へ後からドキュメント修正を取り込むための再設定は行いません。

再設定前にcloneした作業コピーでは、手元の`part-*`タグが旧版を指す場合があります。教材リポジトリ内で次を実行すると、ローカルの`part-*`タグをGitHub上の対応タグへ更新できます。ブランチや作業ファイルは変更しません。

```sh
git fetch origin '+refs/tags/part-*:refs/tags/part-*'
```

GitHubで削除されたタグは、この取得ではローカルから消えません。旧`part-12`が手元に残っている場合は、`git tag -d part-12`で削除できます。

第1・2回の以下の説明も、それぞれのタグ時点の仕様です。最新ブランチでは第5回以降の構造化出力や、後続回のAPIが加わっています。過去の実装を試す場合は、対応タグへcheckoutし、その時点のREADME・package.json・`.nvmrc`を使います。第1〜4回は当時のNode.js 24系、第5回以降と最新ブランチは26系です。

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

## カテゴリとログレベル（第6回）

`withLog(operation, fn, { category, levels, adapter })`で、操作の分類とフェーズ別レベルを設定できます。`category`は各出力イベントへ付与する任意の文字列です。操作名と同様に秘密を含まない固定文字列を使います。ロガー名や階層的な設定キーではありません。

利用断片では公開APIのimportを省略しています。`goto`は呼び出し側が用意する非同期関数です。

```ts
const loggedGoto = withLog('page.goto', goto, {
  category: 'browser',
  levels: { start: 'debug', success: 'debug' },
});
```

未指定または`undefined`のフェーズは`start: info`・`success: info`・`failure: error`へ戻ります。カテゴリ未指定時はプロパティ自体を出力しません。`createEmitter`がカテゴリとレベルを決定し、`ConsoleAdapter`が決定済みレベルをconsoleメソッドへ振り分けます。`debug`も出力され、レベルによるフィルタリングや無効化は行いません。

既存のProxyラッパーも任意の`LogOptions`を受け取り、BrowserからPage・Keyboard・Locatorへ設定を引き継ぎます。同じ実体は最初のラップ設定が有効で、再ラップしても変更しません。[第6回の設計・検証](docs/part-06.md)と`npm run example:part-06`を参照してください。イベントIDやイベントカタログは導入しません。

## AsyncLocalStorageと実行文脈（第7回）

`withRunContext({ runId: 'run-A' }, () => doWork())`で、バッチやシナリオの1回の実行を識別します。公開型`RunContext`はreadonlyな`runId: string`だけです。秘密を含まない値を呼び出し側が用意し、IDの自動生成は行いません。

次は利用形を示す断片です。公開APIのimportを省略し、`work`は呼び出し側が用意する非同期関数とします。

```ts
const loggedWork = withLog('work', work, {
  category: 'batch',
  levels: { start: 'debug', success: 'debug' },
});
await Promise.all([
  withRunContext({ runId: 'run-A' }, () => loggedWork()),
  withRunContext({ runId: 'run-B' }, () => loggedWork()),
]);
```

`createEmitter`がイベント生成時に現在の文脈を読み、`LogEvent`へ`runId`を付けます。文脈がなければプロパティ自体を省きます。ラッパー・Emitter・Proxyは文脈外で事前生成でき、キャッシュ済みの子ラッパーも実行時の文脈を使います。`withLog`は文脈を開始しません。カテゴリ・レベル・初回ラップ設定の優先は第6回のままです。

`runId`は操作呼び出しID、イベントの種類、リソースID、traceId/spanIdとは異なります。Node.js内のPromise／async-awaitを中心に扱い、ブラウザ内JavaScript・別プロセス・通信先へは伝播しません。`run()`内で生成された非同期処理は、待機されないバックグラウンド処理も文脈を引き継ぎ得ます。コールバック完了時に全子処理から文脈が消える保証や、任意のコールバックAPI・EventEmitterでの伝播保証はありません。[第7回の設計・検証](docs/part-07.md)と`npm run example:part-07`を参照してください。

## 呼び出しIDと属性抽出（第8回）

[Issue #45](https://github.com/winuim/ts-logging-lab/issues/45)に対応し、ログ化する各呼び出しに`operationId`を自動付与します。同じrunId内の並行操作でもstartとsuccess/failureを対応付けられます。ID発行失敗時はその呼び出しのIDを省き、本体を続けます。

`withLog`の`extractor: { start, success, failure }`は各フェーズ任意の同期関数です。元関数から推論した引数タプル・解決値・unknownの拒否理由から、実装者が選んだ浅いプリミティブ属性だけを`attributes`へ出力します。未指定や抽出失敗時はattributesを省きます。自動マスキングではないため、秘密を含む値は選ばず、受け取った入力を変更しないでください。

内部の`createOperationLogger`がIDと抽出失敗の隔離を担い、withLogは実行・計測・成否通知に集中します。Proxyの共通Extractorは`unknown[]`/`unknown`を絞り込んで使い、子ラッパーへ初回設定を引き継ぎます。[第8回の設計・制約・検証](docs/part-08.md)と`npm run example:part-08`を参照してください。

## LogAdapterの方針（第5回）

`OperationEvent`・`LogEvent`・`LogAdapter`は小さな契約とし、`withLog`は実行・計測・通知だけを担当します。`createEmitter`が固定メッセージと既定レベルを付加して出力失敗を隔離し、`ConsoleAdapter`がレベル別consoleメソッドへJSONを渡します。

## Adapterと既存ロガー（第9回）

[Issue #47](https://github.com/winuim/ts-logging-lab/issues/47)では`new PinoAdapter(logger)`を`LogOptions.adapter`へ渡します。Pinoの生成と設定はアプリ側で行い、共通のログ生成・文脈取得・属性抽出は第8回のままです。既定の出力先は引き続きConsoleAdapterです。

PinoAdapterは`warning`を`warn`へ対応させ、`level`をPino標準の数値、`message`を`msg`へ変換します。`time`はPinoが出力時に付けます。他のイベント属性は意味を維持し、`attributes`はネストした名前空間のまま渡します。Pinoの`level`設定による出力抑制と、Emitterによるフェーズ別レベルの割り当ては別の責務です。

`redact.paths`は実際の構造に合わせて`attributes.email`等を指定します。この保護は設定したPinoを経由する出力だけに適用され、ConsoleAdapterには及びません。Extractorでは必要な安全な属性だけを選ぶことが第一の対策です。未設定パスやログ処理前の保持、他Adapterへの流出は防ぎません。同期throwの隔離は従来のEmitterが担当し、ストリームの遅延障害・flush完了は保証しません。

```sh
npm run example:part-09
```

ブラウザ不要の実行例はdebugの開始を抑制し、成功のダミー属性をRedactionし、失敗には安全な分類だけを残します。[設計・実出力例・検証と限界](docs/part-09.md)を参照してください。記事は[zenn-contents](https://github.com/winuim/zenn-contents)で管理します。

## 診断ログとイベント購読（第10回）

[Issue #48](https://github.com/winuim/ts-logging-lab/issues/48)では`createDiagnosticLogger({ adapter, category })`を操作ロガーと並列のログ発生源として追加しました。`logger.log(event, level, attributes?)`は共通EmitterとConsole/Pinoへ出力します。`LogAdapter.emit`は操作の`LogEvent`と診断の`DiagnosticLogEvent`を合わせた`LogRecord`を受け取ります。独自Adapterは`kind === 'diagnostic'`で判別してください。既存の操作JSONは維持し、診断にはphase・operationId・durationMsを付けません。

`subscribePageDiagnostics(page, logger)`はpageerror/requestfailedを固定名とレベルだけで通知し、URLや例外詳細を読みません。同じPageは初回loggerで重複を防ぎ、返された解除関数を所有者がfinallyで呼びます。runIdは発火時のALS文脈から取得し、Puppeteerイベントと操作の相関は保証しません。[第10回の設計・互換性・制約・検証](docs/part-10.md)と`npm run example:part-10`を参照してください。記事は[zenn-contents](https://github.com/winuim/zenn-contents)で管理します。

## 統合検証と設計の振り返り（第11回・最終回）

`part-11`は第10回と同じ実装を使い、操作ログ・診断ログ・Proxy・文脈・Pinoを組み合わせて検証します。統合シナリオは[第11回の記事](https://github.com/winuim/zenn-contents/blob/main/articles/ts-logging-lab-part-11.md)に掲載しています。記事にある`article-part-11.mjs`を教材ルートへ保存して実行する例であり、教材内のファイルやnpmコマンドとして提供するものではありません。[教材側の読み方と確認項目](docs/part-11.md)を参照してください。

## 全11回で扱わないこと

OpenTelemetryとの接続、リソースID、任意スコープ、イベントカタログ、共通の自動マスキングは実装していません。導入予定の回も設けません。runIdはアプリ内の一連の実行、operationIdは個々の呼び出しを識別し、traceId/spanIdやPage IDの代わりにはなりません。WeakMapは実体とProxyの参照管理に使います。

機密値を抽出しないことを優先し、PinoのRedactionは設定したパスをそのPino出力だけで保護します。ログの欠落、非同期出力の遅延障害、flushや配送完了の保証、性能評価は別の要件です。新たな要件を扱う場合も、ユーザーと合意した範囲で別途検討します。

## 開発と記事の対応

1. 合意済みの仕様を、依頼された範囲でREADME/AGENTS.mdへ同期する。仕様の同期と、エージェントの実行権限の変更を区別する。
2. 合意済みの回について、依頼されたIssueの範囲で実装する。Issue作成の依頼は実装の許可を、実装の依頼はマージの許可を含まない。全11回で連載を完結し、旧ロードマップだけを根拠にIssue作成や追加機能の実装を進めない。
3. 改訂作業は`rewrite-series`からブランチとPRを作成し、実装・検証・レビュー対応までで結果を報告する。**マージは対象PRについてユーザーから明示的な依頼がある場合のみ行う。** レビュー・検証の成功だけではマージせず、自動マージの有効化にも別途明示的な依頼を必要とする。
4. 依頼に基づくマージ後は、対象PRのマージ先ブランチを最新化して切り替える。改訂作業では`rewrite-series`を使う。マージ済み作業ブランチの削除前にPRのマージ状態と対象ブランチを確認する。未コミット・未反映の変更は切り替えや削除で失わないよう保護し、作業ブランチを削除しない。
5. タグの作成・pushは、タグ名・対象コミット・実施する操作についてユーザーから明示的な依頼がある場合のみ行う。実装完了やマージ完了だけを根拠に実行しない。既存の`part-XX`タグは移動・上書きしない。
6. 記事の変更は依頼された範囲で行い、参照するタグまたはコミットと、記載する実装例・API・実行結果を照合する。Zenn記事は明示的な依頼なしに公開せず、`published: false`を維持する。

マージ・自動マージ・タグ作成やpush・公開などについて、エージェント判断で実行権限を追加・拡大しません。これらの運用ルールの変更は、ユーザーから明示的な指示がある場合のみ行います。合意済みの仕様を文書へ同期することは、こうした実行権限を変更する許可を含みません。

記事にはその回のタグに存在しない機能を「実装済み」として載せません。発展案は明確に区別します。Puppeteerを記事の主役にはせず、**TypeScriptの設計上の課題と解決策**を主題にします。

## セットアップ

最新ブランチと第5回以降のタグはNode.js **26系のみ**をサポートします。パッチバージョンは固定せず、26系の最新パッチを使用してください。npmのバージョン制約は設けず、通常はNode.jsに同梱されたnpmを使用します。nvmを使う場合は次の手順で準備できます。別のバージョン管理ツールでも26系を指定してください。

```sh
nvm install
nvm use
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
| `npm run example:part-10`        | 第10回の実Chromeでの診断イベント購読・Pino出力例                |
| `npm run example:part-09`        | 第9回のPinoによる出力抑制・Redactionの実行例                    |
| `npm run example:part-08`        | 第8回の並列operationId・安全な属性抽出の実行例                  |
| `npm run example:part-07`        | 第7回の並行runId・入れ子・キャッシュ済み子ラッパーの実行例      |
| `npm run example:part-06`        | 第6回のカテゴリ・レベル設定とProxyの実行例                      |
| `npm run example:part-02`        | 実Pageをラップする第2回の実行例                                 |
| `npm run lint`                   | 型情報を使ったESLint検査（警告も失敗扱い）                      |
| `npm run format:check`           | Prettierの整形検査                                              |
| `npm run format`                 | Prettierで整形                                                  |
| `npm run test:integration`       | 実Pageによる統合テスト（事前にbrowser:installが必要）           |

通常の検証は`npm run typecheck`、`npm test`、`npm run build`、`node dist/index.js`、`npm run lint`、`npm run format:check`の順に実行します。GitHub Actionsは課金しない方針のため使用せず、ワークフローは配置しません。PR前にローカルでこれらの検証を実行し、結果をPRに記録します。

### 構成と設計判断

```text
src/                          教材実装（操作・文脈・Adapter・Proxy・診断の公開API）
examples/                     ビルド済みコードを使う小さな実行例
tests/unit/                   ブラウザ不要の単体テスト
tests/integration/            実Pageによるprivate・操作・成功・失敗の統合テスト
vitest.config.ts              単体テストのみを収集
vitest.integration.config.ts  統合テストのみを収集
```

- Node.jsのサポート範囲は`engines.node`の`>=26 <27`で示し、`.nvmrc`は`26`を指定します。`.npmrc`は`save-exact=true`のみとし、`engine-strict`は設定しません。`engines.npm`による制約も設けません。`packageManager`は従来のnpmメタデータとして維持しますが、指定バージョンへの切り替えやグローバルインストールは必須にしません。通常の`npm ci`はこの値でnpmのバージョンを強制しません。
- lockfile内の直接・間接依存の`engines.node`が26系を許容することを確認しています。`@types/node`は既存の24系を維持します。これは型定義のバージョンであり、Node.js 24系の実行時サポートを意味しません。
- TypeScript **6.0.3**、Vitest **5.0.5**、ESLint **10.13.0**、`@eslint/js` **10.0.1**、typescript-eslint **8.72.1**、Prettier **3.9.10**、`@types/node` **24.19.2**を完全固定しています。間接依存はlockfileで固定します。TypeScriptはtypescript-eslintの対応範囲（`<6.1.0`）に合わせています。
- Node.jsでそのまま実行できるESM（`type: module`、`NodeNext`）を使い、相対importには`.js`拡張子を書きます。ビルドは`tsc`だけで行い、バンドラーや独自ランナーは追加しません。
- `strict`に加え、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、未使用・分岐の検査などを有効にします。テストと設定も型検査し、配布用ビルドには`src/`のみを含めます。
- ESLintは型情報を使う厳格なルールを採用し、`any`・非nullアサーション・型アサーションを禁止します。整形はPrettierに任せます。
- Puppeteerが必要なテストは`tests/integration/**/*.test.ts`に置きます。単体テストはこのディレクトリを収集しません。第2回で統合テストとローカルでのブラウザ準備を追加しました。空のテスト群を成功扱いにしません。
- Puppeteer **25.16.0**を開発依存として完全固定しました。Pageの型定義とevaluate内のDOM参照のため、tsconfigのlibにDOM・DOM.Iterableを加えています。型定義を追加しても、Node.js実行時にwindowやdocumentが生えるわけではありません。第9回でPino **10.4.0**を実行時依存として完全固定しました。Pinoの型は新しいAdapterに閉じ込め、共通イベントはロガー非依存を維持します。現在の依存関係にLogTape・OpenTelemetryは含まれていません。
- 第1回のテストはESM公開API経由で、成功・失敗・同期throw・引数と結果の同一性・`this`・並行計測・出力失敗を検証します。型テストの正しい呼び出しと`@ts-expect-error`による不正な呼び出しも`npm run typecheck`で確認します。

設定の根拠：[Node.jsリリース方針](https://github.com/nodejs/Release)、[TypeScript設定](https://www.typescriptlang.org/tsconfig/)、[Vitest導入ガイド](https://vitest.dev/guide/)。

READMEはセットアップ・設計判断・各回とタグの対応、AGENTS.mdは開発時の運用ルールを担当します。各回の実行例は公開APIを直接使い、テストと合わせて動作確認します。Zennの[全11記事の整合性修正PR #23](https://github.com/winuim/zenn-contents/pull/23)では、各回の実装と記事を照合し、再設定済みタグの参照先・実行手順へそろえています。記事の公開やPRのマージは別途の明示指示が必要です。

## 関連

- 既存の実験的実装：[puppeteer-hof-logging](https://github.com/winuim/puppeteer-hof-logging)（教材の完成版と同一ではありません）
- 記事草稿：[zenn-contents](https://github.com/winuim/zenn-contents)（全11回。記事は未公開の草稿）

## ライセンス

`UNLICENSED`（利用許諾なし）とし、`private: true`でnpmへの誤公開を防ぎます。現在のPrivate運用を維持し、ライセンスや公開範囲の変更はユーザーから明示的な指示がある場合のみ行います。

## 第3回の追加

Browser・Page・Keyboard・Locatorと戻り値を共通のProxyで扱います。[設計と動作差](docs/part-03.md)を参照してください。実行例は`npm run example:part-03`です。第2回の節は`part-02`時点の説明であり、現在は子オブジェクトとthisチェーンもラップします。

## 第4回の追加

WeakMapでProxyと実体を対応付け、二重ラップとメソッド参照を安定させます。`unwrap(value)`で登録済みProxyを実体へ戻せます。[設定の優先・寿命・イベント参照の方針](docs/part-04.md)を参照してください。同じ実体は最初の設定を採用します。
