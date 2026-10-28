import {
  argumentSnapshot,
  REDACTED,
  sanitizeAttributes,
} from './masking-policy.js';
import type { ArgumentValue } from './masking-policy.js';
import type { LogAttributes } from './log-event.js';

export interface BeforeContext {
  readonly operation: string;
  readonly args: readonly ArgumentValue[];
}
export type AfterContext<Result> = BeforeContext &
  (
    | {
        readonly resultKind: 'primitive';
        readonly result: Result & ArgumentValue;
      }
    | { readonly resultKind: 'opaque'; readonly result: undefined }
  );
export interface ErrorContext extends BeforeContext {
  readonly failed: true;
}
export interface ContextExtractor<Result = unknown> {
  before?: (context: BeforeContext) => LogAttributes;
  after?: (context: AfterContext<Result>) => LogAttributes;
  error?: (context: ErrorContext) => LogAttributes;
}

export function beforeContext(
  operation: string,
  args: readonly unknown[],
): BeforeContext {
  return Object.freeze({ operation, args: argumentSnapshot(args) });
}
function isPrimitive<T>(value: T): value is T & ArgumentValue {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}
export function afterContext<Result>(
  base: BeforeContext,
  result: Result,
): AfterContext<Result> {
  return isPrimitive(result)
    ? Object.freeze({ ...base, resultKind: 'primitive', result })
    : Object.freeze({ ...base, resultKind: 'opaque', result: undefined });
}
export function extractSafely(call: () => unknown): LogAttributes {
  try {
    const result: unknown = call();
    if (result instanceof Promise) {
      void result.catch(() => undefined);
      return {};
    }
    return sanitizeAttributes(result) ?? {};
  } catch {
    return {};
  }
}

/** 許可したHTTP(S) originのみ。userinfo/path/query/fragmentを返さない。 */
export function safeUrlAttributes(
  value: unknown,
  publicOrigins: readonly string[] = [],
): LogAttributes {
  if (typeof value !== 'string') return { origin: REDACTED };
  try {
    const url = new URL(value);
    return {
      origin:
        (url.protocol === 'https:' || url.protocol === 'http:') &&
        publicOrigins.includes(url.origin)
          ? url.origin
          : REDACTED,
    };
  } catch {
    return { origin: REDACTED };
  }
}
export function navigationContext(
  publicOrigins: readonly string[] = [],
): ContextExtractor {
  const origins = Object.freeze([...publicOrigins]);
  return {
    before: (context) =>
      context.operation === 'page.goto'
        ? safeUrlAttributes(context.args[0], origins)
        : {},
  };
}
export function safeSelectorAttributes(
  value: unknown,
  publicSelectors: readonly string[] = [],
): LogAttributes {
  return {
    selectorLabel:
      typeof value === 'string' &&
      publicSelectors.includes(value) &&
      !/password|passwd|secret|token|authorization|cookie|pin|otp/i.test(value)
        ? value
        : REDACTED,
  };
}
