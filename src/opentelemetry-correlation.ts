import { isSpanContextValid, trace } from '@opentelemetry/api';
import type { Correlation } from './correlation.js';

/** 現在のSpanContextを読むだけ。生成・伝播・Span管理はSDKの責務。 */
export function openTelemetryCorrelation(): Correlation | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (!spanContext || !isSpanContextValid(spanContext)) return undefined;
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}
