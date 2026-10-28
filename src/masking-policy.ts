import type { LogAttributes } from './log-event.js';

export const REDACTED = '[REDACTED]';
export type ArgumentValue = string | number | boolean | null | undefined;
export type ArgumentPolicy = (
  operation: string,
  args: readonly ArgumentValue[],
) => LogAttributes;
export type ArgumentRule = (args: readonly ArgumentValue[]) => LogAttributes;

function hidden(count: number): LogAttributes {
  return { arguments: REDACTED, argumentCount: count };
}

export function createArgumentPolicy(
  rules: Readonly<Record<string, ArgumentRule>> = {},
): ArgumentPolicy {
  const entries = Object.freeze({ ...rules });
  return (operation, args) => {
    const rule = Object.hasOwn(entries, operation)
      ? entries[operation]
      : undefined;
    return rule ? rule(args) : hidden(args.length);
  };
}

/** 非primitiveは中身を読まず伏せ、元のオブジェクトをPolicyへ渡さない。 */
export function argumentSnapshot(
  args: readonly unknown[],
): readonly ArgumentValue[] {
  return Object.freeze(
    args.map((value) => {
      if (
        value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'boolean'
      )
        return value;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      return REDACTED;
    }),
  );
}

const reserved = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'eventId',
  'category',
  'operation',
  'phase',
  'level',
  'message',
  'durationMs',
  'traceId',
  'spanId',
]);

/** ルールの例外・不正値も安全側へ倒す。ルール自体は信頼する開発者コード。 */
export function maskArguments(
  policy: ArgumentPolicy,
  operation: string,
  args: readonly unknown[],
): LogAttributes {
  try {
    const output: unknown = policy(operation, argumentSnapshot(args));
    if (output instanceof Promise) {
      void output.catch(() => undefined);
      return hidden(args.length);
    }
    return sanitizeAttributes(output) ?? hidden(args.length);
  } catch {
    return hidden(args.length);
  }
}

export function sanitizeAttributes(output: unknown): LogAttributes | undefined {
  if (output === null || typeof output !== 'object' || Array.isArray(output))
    return undefined;
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, entryValue] of Object.entries(output)) {
    const value: unknown = entryValue;
    if (reserved.has(key)) return undefined;
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      result[key] = value;
    else return undefined;
  }
  return Object.freeze(result);
}

export function createPuppeteerPolicy(
  publicSelectors: readonly string[] = [],
): ArgumentPolicy {
  const allowed = new Set(publicSelectors);
  function publicSelector(value: ArgumentValue): value is string {
    return (
      typeof value === 'string' &&
      allowed.has(value) &&
      !/password|passwd|secret|token|authorization|cookie|pin|otp/i.test(value)
    );
  }
  return createArgumentPolicy({
    'page.type': (args) => ({
      selector: publicSelector(args[0]) ? args[0] : REDACTED,
      input:
        publicSelector(args[0]) && typeof args[1] === 'string'
          ? args[1]
          : REDACTED,
    }),
    'page.select': (args) => ({
      selector: publicSelector(args[0]) ? args[0] : REDACTED,
      values: publicSelector(args[0])
        ? JSON.stringify(args.slice(1))
        : REDACTED,
      valueCount: Math.max(0, args.length - 1),
    }),
    'keyboard.type': () => ({ input: REDACTED }),
    'locator.fill': () => ({ input: REDACTED }),
    'page.goto': () => ({ target: REDACTED }),
  });
}

export const defaultArgumentPolicy = createPuppeteerPolicy();
