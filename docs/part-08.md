# 第8回：ContextExtractor

[教材の一覧](../README.md#全12回の一覧) · [完成タグ part-08](https://github.com/winuim/ts-logging-lab/tree/part-08)

このページは`part-08`時点の実装と制約を説明します。完成版との差は後続回で確認してください。

LogOptions<Result>へContextExtractor<Result>を追加した。beforeはoperationとprimitiveのみの引数snapshot、afterは同じ文脈と型付きのprimitive結果（有限数等）、errorは文脈とfailed=trueを受ける。非primitive結果はopaque/undefinedとし、生の例外は渡さない。元のオブジェクトへの参照をフックへ渡さず、操作結果の変更を避ける。

フックは同期関数の契約である。例外・不正属性は捨て、誤ってPromiseを返す実行時コードでも拒否を処理して結果を採用しない。Policyにも同じ防御を追加した。返した属性は検証・コピーし、予約属性は拒否する。before/after/errorの属性よりPolicyの既存の秘匿属性を優先し、durationMsは本体の計測値を使う。フック例外で元の操作や拒否理由を置き換えない。

navigationContextはpage.gotoだけに適用し、明示したHTTP(S) originだけを残し、userinfo・path・query・fragmentを返さない。未知origin、非HTTP(S)、不正URL、context不足はREDACTED。safeSelectorAttributesも明示した公開selectorだけを残し秘密名は拒否する。任意のURL・selectorを自動的に安全と判定するわけではない。

追加フックは信頼する開発者コードであり、受け取ったprimitiveの秘密を別属性として返す経路や外部ログを自動防止できない。既定では文脈属性を収集せず、登録時に公開情報の選別と非出力テストを行う。原始結果を含めた全結果の採用や任意オブジェクトの深いコピーはしない。

example:part-08は実通信をしない小さな処理で、秘密入りURLから許可originだけを抽出し、別操作のprimitive結果からresultSizeを取得する。LogTape標準NDJSONとdisposeを使用。単体53件・実Chrome統合7件、型チェック・ビルド・Lint・整形を検証する。ResourceContextとOpenTelemetryはまだ含めない。

## 実行例

リポジトリのルートで実行します。ブラウザなしで実行できます。

```sh
npm run example:part-08
```
