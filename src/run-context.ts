import { AsyncLocalStorage } from 'node:async_hooks';

export interface RunContext {
  readonly runId: string;
}

const storage = new AsyncLocalStorage<RunContext>();

/** 処理の入口で、安全なrunIdだけをコピーして非同期処理へ引き継ぐ。 */
export function withRunContext<Result>(
  context: RunContext,
  callback: () => Result,
): Result {
  return storage.run(Object.freeze({ runId: context.runId }), callback);
}

/** Emitterは生成時ではなく、イベントごとに現在の文脈を読む。 */
export function currentRunId(): string | undefined {
  return storage.getStore()?.runId;
}
