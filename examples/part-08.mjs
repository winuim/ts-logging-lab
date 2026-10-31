import { withLog, withRunContext } from '../dist/index.js';

// 同じrunId・操作名で開始し、2つ目を先に完了させる。
const first = Promise.withResolvers();
const second = Promise.withResolvers();
const fetchData = withLog(
  'fetchData',
  async (items, gate) => {
    await gate;
    return { items };
  },
  {
    category: 'api',
    extractor: {
      start: ([items]) => ({ requestCount: items.length }),
      success: (result) => ({ resultCount: result.items.length }),
      failure: (error) => ({
        errorType: error instanceof Error ? error.name : 'unknown',
      }),
    },
  },
);
await withRunContext({ runId: 'run-A' }, async () => {
  const a = fetchData(['dummy-a'], first.promise);
  const b = fetchData(['dummy-b', 'dummy-c'], second.promise);
  second.resolve();
  await b;
  first.resolve();
  await a;
  try {
    await fetchData([], Promise.reject(new Error('dummy-private-error')));
  } catch {
    // 呼び出し側が本体の失敗を処理する。生のエラーは出力しない。
  }
});
// 文脈なしでもoperationIdが付き、属性を指定しなければattributesを省く。
await withLog('plain', () => Promise.resolve(42))();
