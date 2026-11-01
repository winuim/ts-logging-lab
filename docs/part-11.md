# 第11回：統合して確かめ、責務の分け方を振り返る

全11回の最終回です。[`part-11`タグ](https://github.com/winuim/ts-logging-lab/tree/part-11)は、第10回の`part-10`と同じコミット`2b23935`を指します。新しい機能や公開API、`examples/part-11.mjs`、`example:part-11`コマンドは追加しません。

この文書は最新ブランチ側の読み方を整理したものです。タグ内のドキュメントを更新するために、タグを別コミットへ移動するものではありません。

## 統合シナリオの所在

[第11回の記事](https://github.com/winuim/zenn-contents/blob/main/articles/ts-logging-lab-part-11.md)に、既存APIを組み合わせた統合例を掲載しています。記事の`article-part-11.mjs`を教材ルートへ保存して実行します。記事側の整合性修正は[zenn-contents PR #23](https://github.com/winuim/zenn-contents/pull/23)で管理しています。

Node.js 26系でタグをcheckoutし、依存を導入してビルドします。Chromeを起動できる環境が必要です。

```sh
git checkout part-11
nvm install
nvm use
npm ci
npm run build
npm run browser:install
```

記事のコードを保存した後は、別プロセスで3モードを実行します。

```sh
node article-part-11.mjs console
node article-part-11.mjs pino-debug
node article-part-11.mjs pino-info
```

同じ実体の再ラップは初回の設定を使うため、Adapterを変える比較は新しいPageを使います。実行例は外部サイトの応答に依存せず、通信失敗は送信前のabortで発生させます。Redactionには明示的なダミー値だけを使います。

## 組み合わせて確認すること

| 対象     | 確認する契約                                                                     | 保証しないこと                              |
| -------- | -------------------------------------------------------------------------------- | ------------------------------------------- |
| 操作ログ | 元処理の解決値・拒否理由を保ち、開始と終端をoperationIdで対応付ける              | Promise自体の同一性、ID生成失敗時のID       |
| runId    | 実行入口の文脈をイベント生成時に読む                                             | Page ID、通信先への伝播                     |
| 属性抽出 | 明示的に選んだ浅い属性をattributesへ出す                                         | 秘密の自動判定、Extractorの副作用の巻き戻し |
| 診断ログ | 操作ログと共通Adapterへ出し、operation・phase・operationId・durationMsを付けない | 直前の操作との自動相関、Page ID             |
| Page購読 | 同一Pageと教材Proxyの重複を防ぎ、所有者がfinallyで解除する                       | 参照カウント、Pageのclose時の自動解除       |
| 出力     | ConsoleとPinoを差し替え、Pinoの閾値・指定パスのRedactionを確認する               | 他Adapterの秘匿、flushや配送完了            |

Puppeteer由来の診断イベントにrunIdが付くのは、通知時に有効なALS文脈がある場合です。購読時の文脈を保存する設計ではありません。フィルタで開始・成功ログが消えても、元処理が実行されなかった意味にはなりません。

## 既存テストとの役割分担

統合例は全体を通して出力を観察するためのものです。型と失敗の境界は、既存の単体テストと実Chrome統合テストで確認します。

```sh
npm run typecheck
npm test
npm run build
node dist/index.js
npm run lint
npm run format:check
npm run test:integration
```

テストは`tests/unit/`と`tests/integration/`にあります。HOF・Proxy・同一性、文脈と呼び出しID、属性抽出・出力障害、Pinoの実出力、診断の購読と解除を分けて確認します。第11回用の新しい回帰テストを追加したものではありません。

## 連載の範囲

OpenTelemetry連携、リソースID、任意スコープ、イベントカタログ、共通の自動マスキング、ベンチマークは全11回の実装に含めません。第12回や追加機能を予定済みとして扱わず、新たな要求があれば別途合意した範囲で検討します。
