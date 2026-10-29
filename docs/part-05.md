# 第5回：LogEvent・LogAdapterとLogTape

[教材の一覧](../README.ja.md#全12回の一覧) · [完成タグ part-05](https://github.com/winuim/ts-logging-lab/tree/part-05)

このページは`part-05`時点の実装と制約を説明します。完成版との差は後続回で確認してください。

LogEventはoperation・phase・割り当てlevel・message・primitiveだけのattributesを持ち、LogTapeの型を参照しない。LogAdapterはemit(event): void | Promise<void>という契約だけを持つ。具体的な製品用AdapterはLogTapeAdapterのみ。記録用ダブルとSinkはテスト内だけで使う。

withLogの第3引数でadapterを指定できる。省略時はLogTapeAdapterを使い、ライブラリはconfigureしない。呼び出し側でLogTapeのconfigure/getConsoleSinkなどを設定する。未設定なら出力されない。レベルフィルタ、カテゴリの出力制御、整形、Sink、バッファリング等はLogTapeへ任せる。Pino等の別Adapterや独自出力基盤は作らない。

emitSafelyは同期throw・非同期rejectを隔離する。出力をawaitしないためイベントのflush完了を保証せず、非同期出力の終了はAdapter/Logger側のライフサイクルへ任せる。出力欠落は許容する。生の引数・戻り値・例外はイベントへ入れず、失敗時は元の拒否理由を呼び出し元へ返す。

Proxyのoptionsにもadapterを渡し、BrowserからPage・Keyboard・Locatorへ引き継ぐ。第4回と同じく、同じ実体の設定は初回が有効となる。ログ設定の変更はアプリ側のLogTape構成で行う。

検証は記録用Adapter、同期/非同期の出力失敗、LogTapeのerrorフィルタと構造化属性。既存振る舞いテストのSinkはconsole.infoへ転送するテスト専用設定であり、製品のConsoleAdapterではない。単体33件・実Chrome統合7件と型チェック・ビルド・Lint・整形を確認する。採用版は@logtape/logtape 2.4.2。イベントカタログとマスキングPolicyはまだ追加しない。
