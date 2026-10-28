import { expect, test } from 'vitest';

import * as entrypoint from '../../src/index.js';

test('教材APIのない初期エントリーポイントをESMとして読み込める', () => {
  expect(Object.keys(entrypoint)).toEqual([]);
});
