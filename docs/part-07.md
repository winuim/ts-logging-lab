# 第7回：操作別のArgumentPolicy

[教材の一覧](../README.md#全12回の一覧) · [完成タグ part-07](https://github.com/winuim/ts-logging-lab/tree/part-07)

このページは`part-07`時点の実装と制約を説明します。完成版との差は後続回で確認してください。

ArgumentPolicyは操作名とprimitiveのみの引数スナップショットを受け、LogAttributesを返す。非primitiveは中身を読まずREDACTEDへ置き換え、元のオブジェクト・配列・getter・関数をPolicyへ渡さない。スナップショットは別配列でfreezeする。返却属性もprimitive・有限数だけをコピーし、予約キー、不正値、例外は既定の秘匿表現へ倒す。

createPuppeteerPolicyはpage.type/select、keyboard.type、locator.fill、page.gotoのルールを持つ。既定では全入力を伏せる。page.selectは複数値をまとめて伏せ、個数だけ付ける。公開selectorを明示的にallowlistした場合だけtype/selectの値を許可するが、秘密を示す名前はallowlistでも拒否する。未知selectorやcontext不足は秘匿する。LogTapeのRedactionには依存しない。

createArgumentPolicyで操作ごとの追加ルールを定義できる。example:part-07はpublic.lookupのqueryLengthだけを取り、LogTape標準のNDJSON Formatter/Stream Sinkで出力する。出力終了はLogTapeのdisposeで行い、独自の出力管理は追加しない。

Policyは信頼する開発者コードであり、primitiveの秘密文字列を意図的に返すルールまでは判別できない。operationへ秘密を入れる、外部の生ログへ書く、公開selectorを誤分類する、クロージャから別の秘密を読む経路はPolicyだけでは防げない。生のエラーはPolicyにもイベントにも渡さない。出力Adapterが別経路で秘密を読む可能性も含め、追加ルールは非出力テストで確認する。入力値のコピーは深い再帰をせず、元の引数はそのまま本体へ渡す。

単体46件・実Chrome統合7件と型チェック・ビルド・Lint・整形を検証。未知操作/複数入力/不明context/秘密名、許可selector、追加ルール、不正属性・例外、元引数と拒否理由の保持、成功失敗イベントにダミー秘密がないことを確認する。

## 実行例

リポジトリのルートで実行します。ブラウザなしで実行できます。

```sh
npm run example:part-07
```
