# 第10回：OpenTelemetryのSpanContextをログへ関連付ける

`openTelemetryCorrelation`は`trace.getActiveSpan()?.spanContext()`を参照し、有効な場合だけtraceId/spanIdを返す。`LogOptions.correlation`へこの関数を明示的に渡す。既定では取得しない。LogEvent/LogAdapterにはOTel型を入れず、境界は文字列2つのCorrelationと同期的なCorrelationProviderだけとする。

操作開始時に一度取得し、開始・成功・失敗へ同じIDを転記する。有効なアクティブSpanがない場合は属性を省略する。相関取得の例外や不正IDも属性を省略して本体の戻り値・拒否理由を保つ。Policy/Extractorの属性からtraceId/spanIdを注入させない。相関Provider自体は信頼するアプリの拡張点であり、ID形式の検査は正しいSpanへの所属を証明しない。

APIは@opentelemetry/api 1.10.0、例とテストのSDKは@opentelemetry/sdk-trace 3.0.0 / @opentelemetry/context-async-hooks 3.0.0を固定採用する。SDKと公式ContextManagerは開発依存。例では公式AsyncLocalStorageContextManagerとstartActiveSpanを使用し、並列awaitを越えた伝播を任せる。独自のAsyncLocalStorage、ID生成器、Spanの親子管理は実装しない。例はExporterを接続せず、外部へトレースを送らない。アプリへのSDK登録をライブラリから勝手に行わない。

ResourceContextのIDは実オブジェクトの寿命、trace/spanは非同期操作の文脈という別の責務。診断イベントの発火時に親Spanがあるとは限らず、その扱いは次回で説明する。分散伝播や自動計装は今回の対象外。

単体テストはSpan不在・無効・有効、並列処理、失敗時、LogTapeへの到達、取得失敗、属性の偽装拒否を検証する。計測・出力の成功を本体の成功条件にはしない。例は`npm run example:part-10`で実行できる。

参照: https://opentelemetry.io/docs/languages/js/instrumentation/
