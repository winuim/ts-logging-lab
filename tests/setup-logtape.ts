import { configureSync, resetSync } from '@logtape/logtape';
import { afterEach, beforeEach } from 'vitest';

// 既存の振る舞いテストが観測する、テスト専用のSink。製品のAdapterではない。
beforeEach(() => {
  configureSync({
    reset: true,
    sinks: {
      test(record) {
        // 既存テストはphase/時間を観測する。カタログの固定文言は別テストで検証する。
        const { operation, phase, durationMs } = record.properties;
        const suffix =
          typeof durationMs === 'number'
            ? ` (${durationMs.toFixed(2)} ms)`
            : '';
        console.info(`${String(operation)}: ${String(phase)}${suffix}`);
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
