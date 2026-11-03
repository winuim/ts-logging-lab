/** realmに依存せず、呼び出せるthenを持つ値を判定する。thenのgetterがthrowした場合は呼び出し元へ伝える。 */
export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    'then' in value &&
    typeof value.then === 'function'
  );
}
