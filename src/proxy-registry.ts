// 値からキーへの逆参照があっても、到達不能な組を保持し続けない。
const proxies = new WeakMap<object, object>();
const targets = new WeakMap<object, object>();

// 登録時に同じTの実体・Proxyだけを組にするため、この対応が型の根拠になる。
function isProxyFor<T extends object>(target: T, proxy: object): proxy is T {
  return targets.get(proxy) === target;
}
function isTargetFor<T extends object>(proxy: T, target: object): target is T {
  return proxies.get(target) === proxy;
}

export function cachedProxy<T extends object>(target: T): T | undefined {
  const proxy = proxies.get(target);
  return proxy && isProxyFor(target, proxy) ? proxy : undefined;
}

export function registerProxy<T extends object>(target: T, proxy: T): void {
  proxies.set(target, proxy);
  targets.set(proxy, target);
}

/** このモジュールで登録したProxyを実体へ戻す。その他の値は変えない。 */
export function unwrap<T>(value: T): T {
  if (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function')
  ) {
    const target = targets.get(value);
    if (target && isTargetFor(value, target)) return target;
  }
  return value;
}
