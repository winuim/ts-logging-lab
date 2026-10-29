# 第11回：Pageの診断イベントと購読解除

[教材の一覧](../README.md#全12回の一覧) · [完成タグ part-11](https://github.com/winuim/ts-logging-lab/tree/part-11)

このページは`part-11`時点の実装と制約を説明します。完成版との差は後続回で確認してください。

`subscribeDiagnostics(page, options)`はPuppeteerの既存on/offを利用し、HTTP応答・通信失敗・console・pageerrorをLogEventへ変換する。解除関数を返し、繰り返し解除しても安全。同じ実Page/Proxyへの登録は最初の設定を採用して同じ解除関数を返す。解除後は新設定で再登録できる。closeでも自動解除する。部分的な登録失敗時は登録済みのハンドラも外して例外を呼び出し元へ返す。

カタログにhttp.response(info)、http.failed(warning)、page.console(info)、page.exception(error)を追加し、phaseはdiagnosticとする。operationは固定のpage.diagnostic。HTTP404でもgotoは成功し得るため、operation.failureとは区別する。responseはHTTPステータスと許可したHTTPメソッドのみ、requestfailedはメソッドのみ、consoleは許可した種類のみ、pageerrorはhasExceptionのみ。未知のメソッド/console種類はOTHER、不正なHTTPステータスは0にする。生のURL、ヘッダ、本文、Cookie、consoleのtext/args、例外message/stack、通信失敗のerrorTextは取得しない。

オプションは既存のadapter/resources/correlation/levelOverridesだけ。属性抽出と出力の失敗をハンドラ内で隔離し、本体へ波及させない。リソースIDはPage実体に対応する。相関Providerはイベント発火時のアクティブSpanを参照する。ブラウザイベントが操作のSpanを引き継ぐ保証はなく、購読時のSpanを保存したり直前のgotoから推測して付けたりしない。Span不在ならIDは省略する。

Page以外をキーとする独自イベント基盤は作らず、登録はWeakMapで管理する。解除関数自体を呼び出し元が保持する間はそのクロージャがPageを参照する。長寿命Pageでは必要な区間だけ購読してfinallyで解除する。closeの自動解除は補助であり、アプリ側の所有者と解除責任を明確にする。

実ChromeテストでローカルHTTP404/通信失敗、実console/pageerror、秘密文字列非出力、二重登録、解除/再登録/close、部分登録失敗、複数Page、レベル変更、出力障害を検証する。外部サイトに接続しない。`npm run example:part-11`もローカルサーバーだけを利用する。

## 実行例

リポジトリのルートで実行します。実ブラウザを使います。事前に`npm run browser:install`を実行してください。

```sh
npm run example:part-11
```
