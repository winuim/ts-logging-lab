# 第12回：横断テストと性能計測

## 回帰テストの境界

単体64件・実Chrome統合12件をローカルで検証する。各回で追加した正常・異常・型・同一性・秘匿のテストに加え、最終回ではProxy→Policy→Extractor→ResourceContext→OTel相関→LogTapeの経路をまとめて確認する。

単体はprivateフィールドを使う対象へ安全な属性抽出を適用し、並列SpanのIDが混ざらないこと、戻り値の同一性・同一の拒否理由・元オプションの非破壊性、出力全体にダミー秘密が存在しないことを検証する。実ブラウザでは2つのPageをローカルHTTP404へ並列に遷移し、操作成功、PageごとのresourceId/spanId、診断イベントのHTTP404と機密非収集、解除を確認する。ページ内例外の経路には明示的なテストイベントも使う。実console/pageerrorの発生は第11回のテストで別途確認する。

## 再現コマンド

```sh
npm ci
npm run typecheck
npm test
npm run build
node dist/index.js
npm run lint
npm run format:check
npm run browser:install
npm run test:integration
npm run benchmark -- /private/tmp/ts-logging-benchmark.json
```

GitHub Actionsは使用しない。各回のAPIはその回のタグで確認する。part-12タグはレビュー・mainマージ後に作成する。

## 計測条件

`benchmarks/logging.mjs`は1,000回のウォームアップ後、1ケース5,000回を7反復し、各回で先頭ケースをずらす。1プロセス内の逐次awaitで、すべて同じ引数とPromise.resolve(1)を使う。ベースラインもawaitする。戻り値のチェックサムとロガーの書き込み回数を検査し、計測の取り違えを検知する。

HOFは既定マスキング込みの通常パイプライン、ProxyはそのHOFを含む。masking-disabledは公開selectorの許可リストPolicyへの変更、extractor-disabledはbefore/afterを追加したケース。各ケースは完全に独立した処理時間の分解ではない。これらの差はこの条件での比較であり、コストが加算可能という意味ではない。

logger-enabledはLogTape標準getStreamSinkとJSON Lines Formatterを使い、書き込みを破棄するWritableStreamへ出力する。計測にはdrainまでを含める。無効ケースはLogTapeのlowestLevel:nullを使う。Sink、Formatter、バッファリングは自作しない。破棄ストリームは計測用の出力先であり、本番I/Oを模擬しない。

設定、ラッパー構築、実ブラウザ、ディスク/ネットワークI/O、OTel伝播は計測外。LogEventのdurationMsでオーバーヘッドを測らず、呼び出しの外側のperformance.nowで計測する。メモリやGC回収量は測っていない。

## 記録した実測

測定日時（UTC）: 2026-10-28T21:23:42.599Z。Node v24.22.1 / V8 13.6.233.17-node.58 / darwin 27.0.0 arm64 / Apple M1 Pro（論理CPU 8）。生の全サンプル、環境、親コミット、スクリプトとlockfileのSHA-256を[reference.json](../benchmarks/results/reference.json)に保存する。

単位はμs/完了した呼び出し。

| ケース             |   最小 | 中央値 |   最大 |
| ------------------ | -----: | -----: | -----: |
| baseline           |  0.047 |  0.058 |  0.073 |
| hof-disabled       |  1.237 |  1.372 |  1.643 |
| proxy-disabled     |  1.368 |  1.631 |  1.767 |
| masking-disabled   |  1.238 |  1.346 |  1.452 |
| extractor-disabled |  1.485 |  1.536 |  1.783 |
| logger-enabled     | 10.235 | 10.738 | 13.077 |

最小・最大は7サンプルの範囲で、信頼区間や測定誤差の上限ではない。JIT、GC、OSスケジューラ、電源設定や背景負荷によって変わる。非常に短いベースラインとの比率や、近いケースの順位から一般的な優劣を結論しない。ブラウザ操作の待ち時間が大きい実用途の性能を保証する値でもない。再計測値の一致を要求するテストや閾値は設けない。

## 残る制約

既存の制約（最初のProxy設定を採用、宣言した非同期メソッドだけをログ化、現在のRealmのPromiseを対象、出力完了を本体の成功条件にしない）を維持する。例は教材用であり、プロダクションの監査ログ完全性や分散計装を保証しない。教材と記事の公開範囲・ライセンスは別途判断する。
