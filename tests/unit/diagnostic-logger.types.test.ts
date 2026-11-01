import { expectTypeOf, test } from 'vitest';
import type {
  DiagnosticLogEvent,
  LogEvent,
  LogRecord,
} from '../../src/index.js';

function discriminate(record: LogRecord) {
  if (record.kind === 'diagnostic') {
    expectTypeOf(record).toEqualTypeOf<DiagnosticLogEvent>();
    expectTypeOf(record.event).toEqualTypeOf<string>();
  } else {
    expectTypeOf(record).toEqualTypeOf<LogEvent>();
    expectTypeOf(record.operation).toEqualTypeOf<string>();
  }
}
test('kindで操作と診断を型として判別できる', () => {
  discriminate({
    operation: 'work',
    phase: 'start',
    level: 'info',
    message: 'Operation started',
  });
  discriminate({
    kind: 'diagnostic',
    event: 'sample',
    level: 'error',
    message: 'Diagnostic event',
  });
});

const invalid: DiagnosticLogEvent = {
  kind: 'diagnostic',
  event: 'sample',
  level: 'info',
  message: 'Diagnostic event',
  // @ts-expect-error 診断に偽の操作フェーズを付けない
  phase: 'failure',
};
expectTypeOf(invalid).toEqualTypeOf<DiagnosticLogEvent>();
