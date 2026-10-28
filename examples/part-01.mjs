import console from 'node:console';

import { withLog } from '../dist/index.js';

// ブラウザを必要としない、小さな非同期処理の例。
const greet = withLog('greet', async (name) => {
  await Promise.resolve();
  return `Hello, ${name}!`;
});

console.log(await greet('TypeScript'));

const fail = withLog('fail', async () => {
  await Promise.resolve();
  throw new Error('example failure');
});

try {
  await fail();
} catch {
  console.log('呼び出し側で元の例外を処理しました。');
}
