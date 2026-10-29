# 第6回：イベントカタログとレベル割り当て

[教材の一覧](../README.md#全12回の一覧) · [完成タグ part-06](https://github.com/winuim/ts-logging-lab/tree/part-06)

このページは`part-06`時点の実装と制約を説明します。完成版との差は後続回で確認してください。

eventCatalogへoperation.start/success/failureのID・カテゴリ・既定レベル・固定message・phaseを定義する。Object.freezeとsatisfiesで値の形と不変性を検査し、キーからEventIdを導く。LogEventはそのIDとcategoryを持つが、LogTapeの型は引き続き含めない。

createLogEvent(id, operation, attributes, overrides)は固定メッセージへ値を埋め込まず、operation・処理時間等を別属性として渡す。levelOverridesはID別の割り当てを上書きするだけで、出力可否のフィルタはLogTapeのlowestLevel/Sinkが担当する。未知IDや不正レベルを型で拒否し、JSON等はparseLevelOverridesで実行時検証する。withLogは作成時に設定を検証・コピーするため、不正設定は操作を開始する前に失敗する。

イベントと属性は浅くfreeze・コピーする。属性はprimitiveだけという契約で、任意の機密文字列を安全にする機能ではない。生の引数・戻り値・例外は収集しない。messageテンプレートや独自フィルタは作らない。

LogTapeカテゴリはts-logging-lab/operationとなる。第5回までのoperationを含む可変メッセージから固定メッセージへ変わるため、現在の実行例の表示も変わる。過去タグは動かさない。テスト専用Sinkではphase・時間の観測表現を維持し、実際の固定メッセージ・カテゴリ・属性は別のLogTape結合テストで確認する。

単体41件・実Chrome統合7件、型チェック・ビルド・Lint・整形を確認する。カタログ整合、既定・上書き優先、設定コピー、不正な外部値、不正な型、LogTape結合を含む。マスキングとContextExtractorは後続回で扱う。
