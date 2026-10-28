import { once } from 'node:events';
import { createServer } from 'node:http';
import process from 'node:process';
import { Writable } from 'node:stream';
import {
  configure,
  dispose,
  getJsonLinesFormatter,
  getStreamSink,
} from '@logtape/logtape';
import puppeteer from 'puppeteer';
import {
  ResourceContext,
  subscribeDiagnostics,
  withPageLogging,
} from '../dist/index.js';

await configure({
  sinks: {
    stdout: getStreamSink(Writable.toWeb(process.stdout), {
      formatter: getJsonLinesFormatter(),
      closeStream: false,
    }),
  },
  loggers: [
    { category: ['ts-logging-lab'], lowestLevel: 'info', sinks: ['stdout'] },
    { category: ['logtape', 'meta'], lowestLevel: 'error', sinks: [] },
  ],
});
const server = createServer((_request, response) => {
  response.writeHead(404, { 'Content-Type': 'text/html' });
  response.end('<html>example</html>');
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string')
  throw new Error('Expected TCP port');
const browser = await puppeteer.launch({ headless: true });
try {
  const resources = new ResourceContext();
  const page = withPageLogging(await browser.newPage(), { resources });
  const unsubscribe = subscribeDiagnostics(page, { resources });
  try {
    await page.goto(`http://127.0.0.1:${String(address.port)}/example`);
    const consoleEvent = new Promise((resolve) =>
      page.once('console', resolve),
    );
    await page.evaluate(() => globalThis.console.log('dummy-private-console'));
    await consoleEvent;
  } finally {
    unsubscribe();
  }
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await dispose();
}
