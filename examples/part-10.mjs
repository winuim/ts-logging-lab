import console from 'node:console';
import { setTimeout } from 'node:timers';
import { context, trace } from '@opentelemetry/api';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { configure, dispose, getConsoleSink } from '@logtape/logtape';
import { withLog, openTelemetryCorrelation } from '../dist/index.js';

await configure({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: ['ts-logging-lab'], lowestLevel: 'info', sinks: ['console'] },
    { category: ['logtape', 'meta'], lowestLevel: 'error', sinks: [] },
  ],
});
const provider = new TracerProvider();
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
trace.setGlobalTracerProvider(provider); // 公式SDKのContextManagerを使う。独自伝播は実装しない。
const tracer = provider.getTracer('part-10');
try {
  await Promise.all(
    ['first', 'second'].map((operation) =>
      tracer.startActiveSpan(operation, async (span) => {
        try {
          const run = withLog(
            operation,
            async () => {
              await new Promise((resolve) => setTimeout(resolve, 5));
              return 42;
            },
            { correlation: openTelemetryCorrelation },
          );
          await run();
          console.log(operation, span.spanContext());
        } finally {
          span.end();
        }
      }),
    ),
  );
} finally {
  await provider.shutdown();
  context.disable();
  trace.disable();
  await dispose();
}
