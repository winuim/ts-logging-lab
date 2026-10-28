import process from 'node:process';
import { Writable } from 'node:stream';
import {
  configure,
  dispose,
  getJsonLinesFormatter,
  getStreamSink,
} from '@logtape/logtape';
import puppeteer from 'puppeteer';
import { ResourceContext, withBrowserLogging } from '../dist/index.js';

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
const raw = await puppeteer.launch({ headless: true });
try {
  const resources = new ResourceContext();
  const browser = withBrowserLogging(raw, { resources });
  const context = await browser.createBrowserContext();
  const first = await context.newPage();
  const second = await context.newPage();
  await first.goto('about:blank');
  await first.goto('about:blank');
  await second.goto('about:blank');
  await context.close();
} finally {
  await raw.close();
  await dispose();
}
