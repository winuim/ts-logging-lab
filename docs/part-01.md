# 第1回：高階関数とジェネリクス

[教材の一覧](../README.md#全12回の一覧) · [完成タグ part-01](https://github.com/winuim/ts-logging-lab/tree/part-01)

このページは`part-01`時点の実装と制約を説明します。完成版との差は後続回で確認してください。

完成版では第5回から出力にLogTapeを使います。現在の実行例は[examples/part-01.mjs](../examples/part-01.mjs)を参照してください。

`src/index.ts`から`withLog(operation, fn)`を公開します。操作名は秘密情報を含まない固定文字列にしてください。

以下は`part-01`のAPIを使う例です。importパスは`docs/`内のTypeScriptファイルを想定しています。実行は上記の実行例を使用してください。

```ts
import { withLog } from '../src/index.js';

const greet = withLog('greet', (name: string) =>
  Promise.resolve(`Hello, ${name}!`),
);
const message = await greet('TypeScript'); // Promise<string>、messageはstring
```

`Args`で引数のタプル、`Result`でPromiseの解決値、`This`で呼び出し時の`this`を受け取り、通常の関数を返す高階関数です。引数・結果・拒否理由のオブジェクトはコピーせず渡します。開始を出力してから元関数を一度呼び、成功または失敗を出力します。`performance.now()`で開始ログの後から元処理の完了までを計測し、終端ログにミリ秒で表示します。

```sh
npm run example:part-01
```

このコマンドはビルド後に`examples/part-01.mjs`を実行します。開始・成功・失敗と処理時間を実際に出力し、失敗は呼び出し側で処理します。ブラウザや追加依存は不要です。計測値は実行環境によって変わります。

## 保持する振る舞いと現在の制約

- 対象は`Promise`を返す関数です。引数の必須・省略可能・可変長の型、戻り値の型、明示された`this`型を保持します。元処理の解決値・拒否理由はそのまま返します。
- ラッパーは`async`関数のため、返すPromise自体の同一性は保持しません。Promiseを返す型の関数が同期的にthrowした場合も、同じ理由でrejectするPromiseになります。同期関数・コンストラクター・オーバーロードやジェネリック関数の呼び出しごとの型相関の完全保持は今回の対象外です。
- メソッドを渡しても元インスタンスへ自動bindしません。ラッパーを同じオブジェクトのメソッドとして使うか、`.call(receiver, ...)`で`this`を渡します。自動的なインスタンスのラップは第2回以降で扱います。
- 出力は最小の`console.info`呼び出しです。引数・戻り値・生の例外を出力しません。出力が同期的にthrowしても本体の成功・失敗を変えず、ログの欠落を許容します。プロセス終了や非同期の出力障害を回復する仕組みはありません。
- 第1回のタグにはAdapter・イベントカタログ・ロギング基盤・Puppeteer連携は含まれていません。同じ操作名の並行ログを識別するIDもまだありません。各呼び出しの計測値は独立しています。

## テスト

第1回のテストはESM公開API経由で、成功・失敗・同期throw・引数と結果の同一性・`this`・並行計測・出力失敗を検証します。型テストの正しい呼び出しと`@ts-expect-error`による不正な呼び出しも`npm run typecheck`で確認します。
