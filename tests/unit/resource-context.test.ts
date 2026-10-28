import { expect, test } from 'vitest';
import {
  ResourceContext,
  createLoggingProxy,
  withLog,
  withPageLogging,
} from '../../src/index.js';
import type { LogAttributes, LogEvent } from '../../src/index.js';

test('Proxy・実体・再登録で同じIDと最初の分類を保つ', () => {
  const resources = new ResourceContext();
  const raw = { goto: () => Promise.resolve(null) };
  const proxy = withPageLogging(raw);
  const first = resources.describe(raw, 'page');
  expect(resources.describe(proxy, 'resource')).toBe(first);
  expect(resources.id(raw, 'page')).toBe(resources.id(proxy, 'page'));
  expect(first.kind).toBe('page');
  expect(Object.isFrozen(first)).toBe(true);
});

test('別オブジェクトは別IDで、管理インスタンスの寿命に閉じる', () => {
  const resources = new ResourceContext();
  const a = {},
    b = {};
  expect(resources.id(a, 'page')).not.toBe(resources.id(b, 'page'));
  expect(new ResourceContext().id(a, 'page')).toBe('page-1');
});

test('ログ開始・終了に同じIDを付け、各対象を区別する', async () => {
  const resources = new ResourceContext();
  const events: LogEvent[] = [];
  const adapter = {
    emit(event: LogEvent) {
      events.push(event);
    },
  };
  const a = createLoggingProxy(
    { run: () => Promise.resolve(1) },
    { name: 'a', asyncMethods: ['run'], resources, adapter },
  );
  const b = createLoggingProxy(
    { run: () => Promise.resolve(2) },
    { name: 'b', asyncMethods: ['run'], resources, adapter },
  );
  await Promise.all([a.run(), b.run()]);
  const aEvents = events.filter((event) => event.operation === 'a.run');
  const bEvents = events.filter((event) => event.operation === 'b.run');
  expect(aEvents[0]?.attributes['resourceId']).toBe(
    aEvents[1]?.attributes['resourceId'],
  );
  expect(aEvents[0]?.attributes['resourceId']).not.toBe(
    bEvents[0]?.attributes['resourceId'],
  );
});

test('識別処理の障害で本体の結果を変えない', async () => {
  class FailedResources extends ResourceContext {
    override attributes(): LogAttributes {
      throw new Error('metadata');
    }
  }
  expect(
    await withLog('op', () => Promise.resolve(42), {
      resources: new FailedResources(),
      resource: {},
    })(),
  ).toBe(42);
});
