import process from 'node:process';
import { Writable } from 'node:stream';
import {
  configure,
  dispose,
  getJsonLinesFormatter,
  getStreamSink,
} from '@logtape/logtape';
import {
  createArgumentPolicy,
  createPuppeteerPolicy,
  withLog,
} from '../dist/index.js';

await configure({
  sinks: {
    stdout: getStreamSink(Writable.toWeb(process.stdout), {
      formatter: getJsonLinesFormatter(),
      closeStream: false,
    }),
  },
  loggers: [
    { category: ['ts-logging-lab'], lowestLevel: 'debug', sinks: ['stdout'] },
    { category: ['logtape', 'meta'], lowestLevel: 'error', sinks: ['stdout'] },
  ],
});
try {
  const type = withLog(
    'page.type',
    (selector, value) => Promise.resolve({ selector, value }),
    { argumentPolicy: createPuppeteerPolicy() },
  );
  await type('#password', 'dummy-secret');
  const policy = createArgumentPolicy({
    'public.lookup': (args) => ({
      queryLength: typeof args[0] === 'string' ? args[0].length : 0,
    }),
  });
  const lookup = withLog(
    'public.lookup',
    (query) => Promise.resolve(query.length),
    { argumentPolicy: policy },
  );
  await lookup('hello');
} finally {
  await dispose();
}
