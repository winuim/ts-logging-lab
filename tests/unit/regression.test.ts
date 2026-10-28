import { configureSync } from '@logtape/logtape';
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { expect, test } from 'vitest';
import {
  ResourceContext,
  createLoggingProxy,
  createPuppeteerPolicy,
  navigationContext,
  openTelemetryCorrelation,
  unwrap,
} from '../../src/index.js';

test('Proxy・Policy・Extractor・Resource・OTel・LogTapeを通して秘密を出さず相関を保つ', async () => {
  const records: Readonly<Record<string, unknown>>[] = [];
  configureSync({
    reset: true,
    sinks: {
      capture(record) {
        records.push(record.properties);
      },
    },
    loggers: [
      {
        category: ['ts-logging-lab'],
        lowestLevel: 'debug',
        sinks: ['capture'],
      },
      { category: ['logtape', 'meta'], lowestLevel: 'error', sinks: [] },
    ],
  });
  const provider = new TracerProvider();
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  );
  trace.setGlobalTracerProvider(provider);
  const resources = new ResourceContext();
  const targets = new Map<string, object>();
  const spans = new Map<string, string>();
  const traceIds = new Map<string, string>();
  const secret = 'dummy-regression-secret';
  const originalError = new Error(secret);
  try {
    const result = await Promise.allSettled(
      ['a', 'b'].map((name) =>
        provider.getTracer('regression').startActiveSpan(name, async (span) => {
          spans.set(name, span.spanContext().spanId);
          traceIds.set(name, span.spanContext().traceId);
          const output = { name };
          class Target {
            #value = output;
            async goto(_url: string, _options: object): Promise<object> {
              expect(_url).toContain(secret);
              expect(Object.isFrozen(_options)).toBe(true);
              await new Promise<void>((resolve) =>
                setTimeout(resolve, name === 'a' ? 10 : 1),
              );
              if (name === 'b') throw originalError;
              return this.#value;
            }
          }
          const raw = new Target();
          targets.set(name, raw);
          const proxy = createLoggingProxy(raw, {
            name: 'page',
            asyncMethods: ['goto'],
            resources,
            resourceKind: 'page',
            correlation: openTelemetryCorrelation,
            argumentPolicy: createPuppeteerPolicy(),
            extractor: navigationContext(['https://example.com']),
          });
          expect(unwrap(proxy)).toBe(raw);

          const options = Object.freeze({
            Authorization: secret,
            nested: Object.freeze({ cookie: secret }),
          });
          try {
            const value = await proxy.goto(
              `https://user:${secret}@example.com/${secret}?token=${secret}#${secret}`,
              options,
            );
            expect(value).toBe(output);
            expect(options.nested.cookie).toBe(secret);
            return value;
          } finally {
            span.end();
          }
        }),
      ),
    );
    expect(result[0]?.status).toBe('fulfilled');
    expect(result[1]).toEqual({ status: 'rejected', reason: originalError });
    expect(records).toHaveLength(4);
    expect(JSON.stringify(records)).not.toContain(secret);
    for (const name of ['a', 'b']) {
      const raw = targets.get(name);
      if (!raw) throw new Error('Missing target');
      const own = records.filter(
        (record) => record['resourceId'] === resources.id(raw, 'page'),
      );
      expect(own).toHaveLength(2);
      expect(
        own.every(
          (record) =>
            record['spanId'] === spans.get(name) &&
            record['traceId'] === traceIds.get(name),
        ),
      ).toBe(true);
    }
    expect(new Set(spans.values()).size).toBe(2);
  } finally {
    await provider.shutdown();
    context.disable();
    trace.disable();
  }
});
