/**
 * 非同期処理に最小のログを付与する。引数や例外自体はログに残さない。
 * 元のPromiseと同一にはならないが、解決値と拒否理由はそのまま返す。
 */
export function withLog<This, Args extends unknown[], Result>(
  operation: string,
  fn: (this: This, ...args: Args) => Promise<Result>,
): (this: This, ...args: Args) => Promise<Result> {
  return async function (this: This, ...args: Args): Promise<Result> {
    writeLog(`${operation}: start`);
    const startedAt = performance.now();

    try {
      const result = await fn.apply(this, args);
      const durationMs = performance.now() - startedAt;
      writeLog(`${operation}: success (${durationMs.toFixed(2)} ms)`);
      return result;
    } catch (error: unknown) {
      const durationMs = performance.now() - startedAt;
      writeLog(`${operation}: failure (${durationMs.toFixed(2)} ms)`);
      throw error;
    }
  };
}

function writeLog(message: string): void {
  try {
    console.info(message);
  } catch {
    // 出力先の失敗で、本体の戻り値や例外を変えない。
    // この段階では再試行や別の出力先を用意せず、ログの欠落を許容する。
  }
}
