import { withLog } from './with-log.js';

export interface LoggingProxyOptions<T extends object> {
  name: string;
  /** Promiseを返す操作のみを指定する。同期メソッドはbindだけを行う。 */
  asyncMethods: readonly (keyof T)[];
  /** 同じ公開型を保つラッパーを返す。例外時は元の戻り値を採用する。 */
  wrapResult?: (value: unknown, property: PropertyKey) => unknown;
}

export function createLoggingProxy<T extends object>(
  target: T,
  options: LoggingProxyOptions<T>,
): T {
  const methods = new Set<PropertyKey>(options.asyncMethods);
  const proxy = new Proxy(target, {
    get(raw, property) {
      const value: unknown = Reflect.get(raw, property, raw);
      if (typeof value !== 'function') return finish(value, property);
      const call = (...args: unknown[]): unknown =>
        Reflect.apply(value, raw, args);
      const invoke = methods.has(property)
        ? withLog(`${options.name}.${String(property)}`, (...args: unknown[]) =>
            Promise.resolve(call(...args)),
          )
        : call;
      return (...args: unknown[]): unknown => {
        const result = invoke(...args);
        return result instanceof Promise
          ? result.then((resolved: unknown) => finish(resolved, property))
          : finish(result, property);
      };
    },
    set(raw, property, value: unknown) {
      return Reflect.set(raw, property, value, raw);
    },
  });
  function finish(value: unknown, property: PropertyKey): unknown {
    if (value === target) return proxy;
    try {
      return options.wrapResult ? options.wrapResult(value, property) : value;
    } catch {
      return value;
    }
  }
  return proxy;
}
