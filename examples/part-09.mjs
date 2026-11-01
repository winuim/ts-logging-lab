import pino from 'pino';
import { PinoAdapter, withLog, withRunContext } from '../dist/index.js';

// Pinoの設定はアプリ側で行う。属性は浅いまま、実際のパスを指定する。
const logger = pino({
  base: null, // 教材の出力ではpid/hostnameを省く。
  level: 'info',
  redact: {
    paths: ['attributes.email', 'attributes.token'],
    censor: '[REDACTED]',
  },
});
const save = withLog('user.save', (user) => Promise.resolve({ id: user.id }), {
  adapter: new PinoAdapter(logger),
  category: 'users',
  // debugの開始はPinoが抑制する。成功はinfo、失敗はerrorのまま。
  levels: { start: 'debug' },
  extractor: {
    // Redactionを確認するためのダミー値。実アプリでは秘密値を選ばない。
    success: (user) => ({
      userId: user.id,
      email: 'dummy@example.test',
      token: 'dummy-token',
    }),
    failure: () => ({ errorType: 'save-failed' }),
  },
});
await withRunContext({ runId: 'run-example' }, () => save({ id: 'u1' }));
await withLog(
  'user.save',
  () => Promise.reject(new Error('dummy-private-error')),
  {
    adapter: new PinoAdapter(logger),
    levels: { start: 'debug' },
    extractor: { failure: () => ({ errorType: 'save-failed' }) },
  },
)().catch(() => undefined);
