# 第8回：呼び出しIDとContextExtractorを実行制御から分離する

この文書は[`part-08`タグ](https://github.com/winuim/ts-logging-lab/tree/part-08)（コミット`43cf717`）時点の設計・APIを説明します。後続回の機能は含めません。

## 課題

第7回のrunIdは一連の処理を識別する。同じrunId内で同じoperationを並列に実行すると、開始と終端の対応を特定できない。また、引数・結果・拒否理由を丸ごと出力せず、実装者が許可した件数などの属性だけを記録したい。

## 設計上の選択

[Issue #45](https://github.com/winuim/ts-logging-lab/issues/45)に対応する。`withLog`は元関数の実行・計測・成否判定と通知を担当する。`createOperationLogger`は内部モジュールとし、各呼び出しの開始時にNode.js標準の`randomUUID()`でoperationIdを一つ発行し、success/failureのクロージャーに保持する。ID発行に失敗した場合は、その呼び出しの両フェーズからoperationIdを省く。本体処理は続ける。

operationIdはラッパー生成時・メソッド取得時には発行せず、ALSにも保存しない。キャッシュ済みProxyを再利用しても呼び出しごとに新しいIDになる。runIdとは独立しており、親子関係・リソース・Spanは表さない。

`ContextExtractor<Args, Result>`のstartは引数タプル、successは解決値、failureはunknownの拒否理由を受け取る。それぞれ省略可能な同期関数で、戻り値の`LogAttributes`はreadonlyな浅い`Record<string, string | number | boolean | null>`。抽出関数のないフェーズではattributesプロパティを省く。空オブジェクトを返した場合は`attributes: {}`を出力する。

抽出は信頼するアプリケーション実装者の責務であり、関数には元の値への参照を渡す。入力の変更・外部への送信などの副作用を防ぐサンドボックスではない。機密情報を含まない項目だけを選び、入力は変更しない。型は文字列の秘密性を判定できず、自動マスキングも行わない。

抽出結果は浅くコピーし、実行時にもプリミティブ値だけを採用する。関数・ネストした値・非有限数は除外するため、結果のtoJSON関数を持ち込まない。抽出がthrowした場合は属性だけを省き、開始や終端のイベントは出す。誤ってPromiseが返された場合も属性を省き、その拒否を回収する。これはJSからの誤用に対する防御で、非同期Extractorのサポートではない。

`createEmitter`はOperationEventのoperationId/attributesを明示的に引き継ぎ、従来どおりカテゴリ・レベル・固定メッセージ・実行時のrunIdを付ける。入力イベントや抽出結果をトップレベルへ展開しない。ConsoleAdapterは出力だけを担当し、同期throw・Promise rejectの隔離はcreateEmitterに残す。ログ処理に失敗しても成功をfailureへ分類せず、元の結果・拒否理由を返す。ログ欠落の再試行や診断ログは追加しない。

## 実装

次は公開APIを使う小例。値そのものではなく件数を選ぶ。

```ts
import { withLog } from '../src/index.js';

const fetchData = withLog(
  'fetchData',
  (items: string[]) => Promise.resolve({ items }),
  {
    category: 'api',
    extractor: {
      start: ([items]) => ({ requestCount: items.length }),
      success: (result) => ({ resultCount: result.items.length }),
      failure: (error) => ({
        errorType: error instanceof Error ? error.name : 'unknown',
      }),
    },
  },
);
await fetchData(['dummy-input']);
```

`withLog`のオプションは`LogOptions<Args, Result>`。Args/Resultは元関数から推論し、Extractor側から元関数の型を変更しない。既定の型引数は`unknown[]`と`unknown`であり、複数メソッドへ共通設定を渡すProxyラッパーはこの契約を使う。Proxyの呼び出し元の型は従来どおり保つが、共有Extractor内で個別メソッドの引数・結果の型は推論できない。`typeof`等で絞り込む必要がある。BrowserからPage・Keyboard・Locatorへの設定継承と初回設定優先は維持する。操作別レジストリや型アサーションによる一般化は追加しない。

```sh
npm run example:part-08
```

実行例はブラウザ不要。同じrunIdの並列呼び出しを逆順に完了し、成功・失敗の属性と文脈なしの出力を確認できる。出力は実行時のUUIDと処理時間を含み、固定値にはしない。

## テスト

単体テストでは同じ操作名の並列呼び出しをゲートで逆順に完了し、同一呼び出しのstart/終端だけがIDを共有することを確認する。runIdあり・なし、型推論と不正な型の拒否、フェーズ部分指定、浅い属性コピーと秘密文字列の不在を検証する。各フェーズの抽出失敗、ID発行失敗、同期／非同期Adapter障害でも元関数のthis・引数・結果・拒否理由・呼び出し回数を保持する。

実Chrome統合テストではキャッシュ済みBrowser/Page/Keyboard/Locatorとチェーンを異なるrunIdで再利用し、全操作のID対応と共通Extractorの継承を確認する。JSON出力・既存のProxyの動作も既存テストと合わせて検証する。

## 残る課題

自動マスキング、操作別Extractorレジストリ、非同期抽出、リソース識別、親子operationId、OpenTelemetry/Span連携、フィルタリング、flush保証、イベントカタログは対象外。次の第9回ではPinoAdapterを追加し、出力抑制と設定したパスのRedactionをPinoに任せる。これらは第8回には含めない。記事はzenn-contentsで管理する。
