import process from 'node:process';
import { Writable } from 'node:stream';
import {
  configure,
  dispose,
  getJsonLinesFormatter,
  getStreamSink,
} from '@logtape/logtape';
import { navigationContext, withLog } from '../dist/index.js';

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
  const navigate = withLog(
    'page.goto',
    (url) => Promise.resolve(url.length > 0),
    {
      extractor: navigationContext(['https://example.test']),
    },
  );
  await navigate(
    'https://user:dummy-secret@example.test/private?token=dummy-secret#secret',
  );
  const count = withLog(
    'public.count',
    (query) => Promise.resolve(query.length),
    {
      extractor: {
        after(context) {
          return {
            resultSize:
              context.resultKind === 'primitive' &&
              typeof context.result === 'number'
                ? context.result
                : 0,
          };
        },
      },
    },
  );
  await count('hello');
} finally {
  await dispose();
}
