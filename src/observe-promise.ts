export interface PromiseObserver<Result> {
  readonly success?: (value: Result) => void | PromiseLike<void>;
  readonly failure?: (reason: unknown) => void | PromiseLike<void>;
}

/** 通知の完了を待たず、通知側のthrow・rejectを本体の結果から隔離する。 */
function notify<Value>(
  callback: ((value: Value) => void | PromiseLike<void>) | undefined,
  value: Value,
): void {
  try {
    const result = callback?.(value);
    if (result) void Promise.resolve(result).catch(() => undefined);
  } catch {
    // 観測側の失敗で本体の結果を変更しない。
  }
}

/** thenableを標準Promiseへ変換し、解決値・拒否理由を保持して完了を通知する。 */
export function observePromise<Result>(
  value: PromiseLike<Result>,
  observer: PromiseObserver<Awaited<Result>>,
): Promise<Awaited<Result>> {
  return Promise.resolve(value).then(
    (result) => {
      notify(observer.success, result);
      return result;
    },
    (reason: unknown) => {
      notify(observer.failure, reason);
      throw reason;
    },
  );
}
