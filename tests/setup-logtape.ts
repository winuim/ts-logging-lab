import { configureSync, resetSync } from '@logtape/logtape';
import { afterEach, beforeEach } from 'vitest';

// 既存の振る舞いテストが観測する、テスト専用のSink。製品のAdapterではない。
beforeEach(() => {
  configureSync({
    reset: true,
    sinks: {
      test(record) {
        console.info(record.message.join(''));
      },
    },
    loggers: [
      { category: ['ts-logging-lab'], lowestLevel: 'debug', sinks: ['test'] },
      { category: ['logtape', 'meta'], lowestLevel: 'error', sinks: [] },
    ],
  });
});
afterEach(() => {
  resetSync();
});
