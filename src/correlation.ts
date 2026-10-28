import type { LogAttributes } from './log-event.js';

/** ロガーにもOTelにも依存しない、ログへ転記する最小の契約。 */
export interface Correlation {
  readonly traceId: string;
  readonly spanId: string;
}
export type CorrelationProvider = () => Correlation | undefined;

export function captureCorrelation(
  provider: CorrelationProvider | undefined,
): LogAttributes {
  try {
    const value = provider?.();
    if (
      !value ||
      !/^[0-9a-f]{32}$/.test(value.traceId) ||
      !/^[0-9a-f]{16}$/.test(value.spanId) ||
      /^0+$/.test(value.traceId) ||
      /^0+$/.test(value.spanId)
    )
      return {};
    return { traceId: value.traceId, spanId: value.spanId };
  } catch {
    return {};
  }
}
