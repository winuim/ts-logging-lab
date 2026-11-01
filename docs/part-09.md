# 第9回：Adapterで既存ロガーとの境界を作る

この文書は[`part-09`タグ](https://github.com/winuim/ts-logging-lab/tree/part-09)（コミット`4065230`）時点の設計・APIを説明します。後続回の機能は含めません。

## 課題

第8回までにログ生成と出力を分離した。ConsoleAdapterは全イベントをconsoleへ出力する。ログレベルに応じた抑制や特定属性の秘匿を追加するとき、共通側へ独自のフィルタやRedactionエンジンを追加すると責務が広がる。

## 設計上の選択

[Issue #47](https://github.com/winuim/ts-logging-lab/issues/47)ではPinoAdapterを追加し、既存のLogAdapter契約でPinoへ接続する。Pino 10.4.0を実行時依存として固定する。Pinoの生成・設定・出力先の所有者はアプリケーションであり、Adapterは渡されたロガーの4メソッドだけを使う。公開コンストラクターの型は`Pick<Logger, 'debug' | 'info' | 'warn' | 'error'>`。共通のLogEventやContextExtractorはPinoの型を参照しない。

withLog、createOperationLogger、createEmitter、withRunContext、ConsoleAdapterは変更しない。イベントのカテゴリ・レベル・メッセージ・runId・operationId・属性は従来どおり生成する。既定のAdapterもConsoleAdapterのまま。Pinoのmixin/childでrunIdを再付与したり、独自のALS管理を追加したりしない。

| 共通イベント                                                    | Pino標準設定での出力                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------- |
| debug / info / warning / error                                  | debug / info / warn / errorを呼び、数値level 20 / 30 / 40 / 50 |
| message                                                         | 第2引数として渡し、msgへ出力                                   |
| 時刻（共通イベントにはない）                                    | Pinoが出力時のtimeを付与                                       |
| operation / phase / durationMs / category / runId / operationId | 同名のフィールドとして保持。未指定は省略                       |
| attributes                                                      | 同名のオブジェクトに保持。トップレベルへ展開しない             |

Adapterはlevel/messageをオブジェクトから取り除いてからPinoへ渡す。levelとmessageを二重に保持せず、time/msgとの衝突も作らない。属性にlevel/time/msgというキーがあってもattributes内に留まる。Pinoの既定ではpid/hostnameも出力する。アプリがmessageKey、formatters、bindings等をカスタマイズした場合、その出力契約と衝突回避はアプリ側で管理する。本教材は標準フィールド設定を使用する。

Emitterのレベル割り当てと、Pinoの出力閾値は独立する。debugを割り当ててもPinoがinfo以上に設定されていれば出力されない。抑制されるイベントでも従来どおり属性抽出とイベント生成は実行される。

## 実装と実行例

次は公開APIによる小例。ダミー値を意図的に抽出し、設定パスと出力の対応を示す。実アプリでは必要な安全な属性だけを選ぶ。

```ts
import pino from 'pino';
import { PinoAdapter, withLog } from '../src/index.js';

const logger = pino({
  level: 'info',
  redact: {
    paths: ['attributes.email', 'attributes.token'],
    censor: '[REDACTED]',
  },
});
const save = withLog('user.save', (id: string) => Promise.resolve({ id }), {
  adapter: new PinoAdapter(logger),
  levels: { start: 'debug' },
  extractor: {
    success: (user) => ({ userId: user.id, email: 'dummy@example.test' }),
  },
});
await save('u1');
```

`LogAttributes`は浅いプリミティブ値の辞書を維持する。`attributes.email`というパスは、属性の値に新たなネスト構造を許可することを意味しない。Pinoが受け取るイベントのattributes名前空間を指す。パスは大文字小文字も一致させ、ユーザー入力から生成しない。

```sh
npm run example:part-09
```

examples/part-09.mjsは実際のJSONを出力する。開始debugは抑制され、成功infoにはrunId、operationId、処理時間、カテゴリ、秘匿したダミー属性が残る。別の失敗例は生の拒否理由を出さず安全なerrorTypeだけを残す。UUID・time・durationMsは実行ごとの実測値であり固定しない。

Node.js 26.13.0 / Pino 10.4.0で取得した実出力例（実行例では`base: null`でpid/hostnameを省略）：

```json
{"level":30,"time":1793463292440,"operation":"user.save","phase":"success","durationMs":0.015833000000000652,"operationId":"3178a7c5-f5d5-4740-bbe0-92a2942a1053","attributes":{"userId":"u1","email":"[REDACTED]","token":"[REDACTED]"},"category":"users","runId":"run-example","msg":"Operation succeeded"}
{"level":50,"time":1793463292440,"operation":"user.save","phase":"failure","durationMs":0.031999999999996476,"operationId":"600b40ef-3398-4ac7-8f0e-40128c680776","attributes":{"errorType":"save-failed"},"msg":"Operation failed"}
```

## テスト

tests/unit/pino-adapter.test.tsではPino本体とメモリ上の同期出力先を使う。4レベルの数値・warningからwarnへの対応、標準キーの重複不在、閾値での出力抑制、実出力文字列からダミー秘密値が消えること、非対象属性と入力の非破壊性を確認する。並列操作を逆順に完了し、runId・operationId・各フェーズ・処理時間・カテゴリ・属性の対応を確認する。

同じ操作でConsoleAdapterとPinoAdapterを差し替え、this・引数・戻り値・拒否理由の同一性と呼び出し回数を確認する。Pinoの出力先が同期throwしても本体の成功・失敗は変わらない。返されたPromise rejectの隔離は既存の共通側テストが担う。既存単体テストと実Chrome統合テストも実行する。

## 残る課題と適用範囲

Redactionは設定されたPinoを経由する出力だけの追加保護であり、ConsoleAdapterや独自Adapterには適用されない。未設定パス、ログ処理前のメモリ保持、Extractorの副作用、設定外の出力経路を保護する仕組みではない。秘密値を最初から抽出しないことが第一の対策となる。

既存LogAdapterの失敗隔離はemit呼び出し時の同期throwと返されたPromise rejectまで。PinoAdapterのemitはvoidを返し、後から起きるストリームのerrorやflush・配送完了を保証しない。出力先の障害管理はアプリケーション側の課題として残す。

独自Redactionエンジン、共通マスキング、独自フィルタ、OpenTelemetry、リソース識別、高度なTransport、ローテーションは追加しない。次の第10回では診断ログとPageイベント購読を共通出力へ接続する。第11回は既存機能の統合検証と振り返りを行う最終回。これらを第9回の実装として説明しない。記事はzenn-contentsで管理する。

参考：[Pino API](https://github.com/pinojs/pino/blob/v10.4.0/docs/api.md)、[Pino Redaction](https://github.com/pinojs/pino/blob/v10.4.0/docs/redaction.md)。
