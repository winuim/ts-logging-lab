import { configureSync } from '@logtape/logtape';
import { context, trace, TraceFlags, ROOT_CONTEXT } from '@opentelemetry/api';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { withLog, openTelemetryCorrelation } from '../../src/index.js';
import type { LogEvent } from '../../src/index.js';

const provider = new TracerProvider();
beforeAll(() => {
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  );
  trace.setGlobalTracerProvider(provider);
});
afterAll(async () => {
  await provider.shutdown();
  context.disable();
  trace.disable();
});

test('アクティブSpanなしでは相関属性を付けない', async () => {
  expect(openTelemetryCorrelation()).toBeUndefined();
  const events: LogEvent[] = [];
  const run = withLog('op', () => Promise.resolve(42), {
    correlation: openTelemetryCorrelation,
    adapter: {
      emit(event) {
        events.push(event);
      },
    },
  });
  expect(await context.with(ROOT_CONTEXT, run)).toBe(42);
  expect(events).toHaveLength(2);
  expect(events[0]?.attributes).not.toHaveProperty('traceId');
});

test('無効なSpanContextは無視する', () => {
  const invalid = trace.setSpanContext(ROOT_CONTEXT, {
    traceId: '0'.repeat(32),
    spanId: '0'.repeat(16),
    traceFlags: TraceFlags.NONE,
  });
  expect(context.with(invalid, openTelemetryCorrelation)).toBeUndefined();
});

test('公式SDKの並列Spanが混線せず、開始・成功で同じIDを保つ', async () => {
  const events: LogEvent[] = [];
  const tracer = provider.getTracer('tests');
  const expected = new Map<string, string>();
  await Promise.all(
    ['a', 'b'].map((name) =>
      tracer.startActiveSpan(name, async (span) => {
        expected.set(name, span.spanContext().spanId);
        try {
          await withLog(
            name,
            async () => {
              await new Promise<void>((resolve) =>
                setTimeout(resolve, name === 'a' ? 15 : 1),
              );
              return name;
            },
            {
              correlation: openTelemetryCorrelation,
              adapter: {
                emit(event) {
                  events.push(event);
                },
              },
            },
          )();
        } finally {
          span.end();
        }
      }),
    ),
  );
  expect(new Set(expected.values()).size).toBe(2);
  for (const name of ['a', 'b']) {
    const own = events.filter((event) => event.operation === name);
    expect(own).toHaveLength(2);
    expect(
      own.every((event) => event.attributes['spanId'] === expected.get(name)),
    ).toBe(true);
    expect(own[0]?.attributes['traceId']).toMatch(/^[0-9a-f]{32}$/);
  }
});

test('失敗ログとLogTapeまで同じ相関を届け、秘密の例外を出さない', async () => {
  const properties: Readonly<Record<string, unknown>>[] = [];
  configureSync({
    reset: true,
    sinks: {
      capture(record) {
        properties.push(record.properties);
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
  const error = new Error('dummy-secret');
  await provider.getTracer('tests').startActiveSpan('failure', async (span) => {
    try {
      await expect(
        withLog('failure', () => Promise.reject(error), {
          correlation: openTelemetryCorrelation,
          argumentPolicy: () => ({ traceId: 'spoof', spanId: 'spoof' }),
        })(),
      ).rejects.toBe(error);
      expect(properties).toHaveLength(2);
      expect(
        properties.every((p) => p['spanId'] === span.spanContext().spanId),
      ).toBe(true);
      expect(JSON.stringify(properties)).not.toContain('dummy-secret');
    } finally {
      span.end();
    }
  });
});

test('相関取得の例外・不正なIDでも元の戻り値・例外を保つ', async () => {
  const events: LogEvent[] = [];
  const adapter = {
    emit(event: LogEvent) {
      events.push(event);
    },
  };
  expect(
    await withLog('bad', () => Promise.resolve(1), {
      adapter,
      correlation: () => ({ traceId: 'bad', spanId: 'bad' }),
    })(),
  ).toBe(1);
  const error = new Error('body');
  await expect(
    withLog('throws', () => Promise.reject(error), {
      adapter,
      correlation: () => {
        throw new Error('metadata');
      },
    })(),
  ).rejects.toBe(error);
  expect(
    events.every((event) => event.attributes['traceId'] === undefined),
  ).toBe(true);
});
