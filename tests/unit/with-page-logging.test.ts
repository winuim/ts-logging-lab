import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { withPageLogging } from '../../src/index.js';

// Page.gotoの最小契約に、#private・getter・setter・未ラップメソッドを持つ。
class PageFixture {
  #url = 'about:blank';
  readonly response = { ok: true };
  readonly error = new Error('dummy-secret');
  calls = 0;

  get currentUrl(): string {
    return this.#url;
  }

  set currentUrl(value: string) {
    this.#url = value;
  }

  goto(url: string): Promise<null> {
    this.calls += 1;
    this.#url = url;
    if (url === 'reject') return Promise.reject(this.error);
    if (url === 'throw') throw this.error;
    return Promise.resolve(null);
  }

  url(): string {
    return this.#url;
  }

  readResponse(): typeof this.response {
    return this.response;
  }

  fail(): never {
    throw this.error;
  }

  asyncFail(): Promise<never> {
    return Promise.reject(this.error);
  }

  chain(): this {
    return this;
  }
}

describe('withPageLogging', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('素朴なProxyは#privateのgetter・メソッドを壊す', () => {
    const raw = new PageFixture();
    const naive = new Proxy(raw, {
      get(target, property, receiver): unknown {
        return Reflect.get(target, property, receiver);
      },
    });
    expect(() => naive.currentUrl).toThrow(TypeError);
    expect(() => naive.url()).toThrow(TypeError);
    expect(() => naive.goto('about:blank')).toThrow(TypeError);
  });

  test('getterだけ直しても未ラップメソッドのthisがProxyになる', () => {
    const raw = new PageFixture();
    const partial = new Proxy(raw, {
      get(target, property): unknown {
        return Reflect.get(target, property, target);
      },
    });
    expect(partial.currentUrl).toBe('about:blank');
    expect(() => partial.url()).toThrow(TypeError);
  });

  test('getter・setterと未ラップメソッドが実インスタンスを使う', () => {
    const raw = new PageFixture();
    const page = withPageLogging(raw);
    expect(page).not.toBe(raw);
    expect(page.currentUrl).toBe('about:blank');
    page.currentUrl = 'fixture:updated';
    expect(raw.url()).toBe('fixture:updated');
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Proxyが実体にbindした関数を返すことを検証する。
    const detached = page.url;
    expect(detached()).toBe('fixture:updated');
    expect(page.url.call({})).toBe('fixture:updated');
    expect(page.readResponse()).toBe(raw.response);
    expect(console.info).not.toHaveBeenCalled();
  });

  test('ログ対象はgotoだけで、結果・引数・呼び出し回数を保持する', async () => {
    const raw = new PageFixture();
    const page = withPageLogging(raw);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- ログ対象もProxy内で実体へbindされる。
    const goto = page.goto;
    expect(await goto('dummy-token')).toBeNull();
    expect(raw.calls).toBe(1);
    expect(page.url()).toBe('dummy-token');
    expect(console.info).toHaveBeenNthCalledWith(1, 'page.goto: start');
    expect(console.info).toHaveBeenLastCalledWith(
      expect.stringMatching(/^page.goto: success \(\d+\.\d{2} ms\)$/),
    );
    expect(console.info).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
      'dummy-token',
    );
  });

  test.each(['reject', 'throw'])(
    'gotoの%sを同じエラーでrejectする',
    async (url) => {
      const raw = new PageFixture();
      const page = withPageLogging(raw);
      await expect(page.goto(url)).rejects.toBe(raw.error);
      expect(raw.calls).toBe(1);
      expect(console.info).toHaveBeenLastCalledWith(
        expect.stringMatching(/^page.goto: failure \(\d+\.\d{2} ms\)$/),
      );
      expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
        'dummy-secret',
      );
    },
  );

  test('対象外メソッドの同期・非同期の失敗をそのまま保持する', async () => {
    const raw = new PageFixture();
    const page = withPageLogging(raw);
    expect(() => page.fail()).toThrow(raw.error);
    await expect(page.asyncFail()).rejects.toBe(raw.error);
    expect(console.info).not.toHaveBeenCalled();
  });

  test('出力先の失敗でgotoの成功・失敗を変えない', async () => {
    const raw = new PageFixture();
    const page = withPageLogging(raw);
    vi.mocked(console.info).mockImplementation(() => {
      throw new Error('output unavailable');
    });
    expect(await page.goto('about:blank')).toBeNull();
    await expect(page.goto('reject')).rejects.toBe(raw.error);
  });

  test('第3回ではthisの戻り値をProxyへ戻してチェーンを保つ', () => {
    const raw = new PageFixture();
    const page = withPageLogging(raw);
    expect(page.chain()).toBe(page);
    expect(page.chain()).not.toBe(raw);
  });

  test('native内部スロットが必要なgetter・メソッドにも実体を渡す', () => {
    class PageWithMap extends Map<string, number> {
      goto(): Promise<null> {
        return Promise.resolve(null);
      }
    }
    const raw = new PageWithMap([['answer', 42]]);
    const naive = new Proxy(raw, {});
    expect(() => naive.size).toThrow(TypeError);
    expect(() => naive.get('answer')).toThrow(TypeError);
    const page = withPageLogging(raw);
    expect(page.size).toBe(1);
    expect(page.get('answer')).toBe(42);
    expect([...page]).toEqual([['answer', 42]]);
  });
});
