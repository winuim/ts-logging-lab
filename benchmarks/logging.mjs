import { URL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import console from 'node:console';
import {
  configure,
  dispose,
  getJsonLinesFormatter,
  getStreamSink,
} from '@logtape/logtape';
import {
  createLoggingProxy,
  createPuppeteerPolicy,
  withLog,
} from '../dist/index.js';

// 固定条件。結果を見て反復数や対象ケースを選び直さない。
const iterations = 5000;
const warmupIterations = 1000;
const repetitions = 7;
const args = ['#public-search', 'dummy-input'];
const raw = (_selector, _input) => {
  void _selector;
  void _input;
  return Promise.resolve(1);
};
const policy = createPuppeteerPolicy(['#public-search']);
const cases = [
  { name: 'baseline', create: () => raw },
  { name: 'hof-disabled', create: () => withLog('page.type', raw) },
  {
    name: 'proxy-disabled',
    create: () => {
      const proxy = createLoggingProxy(
        { type: raw },
        { name: 'page', asyncMethods: ['type'] },
      );
      return (...values) => proxy.type(...values);
    },
  },
  {
    name: 'masking-disabled',
    create: () => withLog('page.type', raw, { argumentPolicy: policy }),
  },
  {
    name: 'extractor-disabled',
    create: () =>
      withLog('page.type', raw, {
        extractor: {
          before: () => ({ operationClass: 'example' }),
          after: () => ({ complete: true }),
        },
      }),
  },
  {
    name: 'logger-enabled',
    enabled: true,
    create: () => withLog('page.type', raw),
  },
];
const samples = new Map(cases.map(({ name }) => [name, []]));
let checksum = 0;
async function sample(entry, count) {
  let writes = 0;
  const sink = getStreamSink(
    new globalThis.WritableStream({
      write() {
        writes++;
      },
    }),
    {
      formatter: getJsonLinesFormatter(),
    },
  );
  await configure({
    reset: true,
    sinks: { stream: sink },
    loggers: [
      {
        category: ['ts-logging-lab'],
        lowestLevel: entry.enabled ? 'info' : null,
        sinks: ['stream'],
      },
      { category: ['logtape', 'meta'], lowestLevel: 'error', sinks: [] },
    ],
  });
  const run = entry.create();
  const start = performance.now();
  for (let i = 0; i < count; i++) checksum += await run(...args);
  await sink.drain(); // LogTapeに受理された出力の完了まで含める。
  const elapsedMs = performance.now() - start;
  await dispose();
  const expectedWrites = entry.enabled ? count * 2 : 0;
  if (writes !== expectedWrites)
    throw new Error(`Unexpected writes for ${entry.name}: ${writes}`);
  return (elapsedMs * 1e6) / count;
}
for (const entry of cases) await sample(entry, warmupIterations);
for (let round = 0; round < repetitions; round++) {
  // 各回で先頭をずらし、固定順序の影響を減らす。
  for (let offset = 0; offset < cases.length; offset++) {
    const entry = cases[(round + offset) % cases.length];
    samples.get(entry.name).push(await sample(entry, iterations));
  }
}
const sha256 = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
const result = {
  measuredAt: new Date().toISOString(),
  environment: {
    node: process.version,
    v8: process.versions.v8,
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    execArgv: process.execArgv,
  },
  source: {
    baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    scriptSha256: await sha256(new URL(import.meta.url)),
    lockfileSha256: await sha256(
      new URL('../package-lock.json', import.meta.url),
    ),
  },
  conditions: {
    iterations,
    warmupIterations,
    repetitions,
    serialAwait: true,
    units: 'nanoseconds per completed call',
    order: 'rotated by round',
    enabledSink:
      'LogTape getStreamSink + JSON Lines formatter + discard WritableStream; drain included',
    excluded:
      'configuration, wrapper construction, real browser, disk/network I/O, OTel propagation',
    caveat:
      'single process; min/max are sample range, not confidence bounds; no performance guarantee',
  },
  checksum,
  results: cases.map(({ name }) => {
    const values = samples.get(name);
    const sorted = [...values].sort((a, b) => a - b);
    return {
      name,
      samplesNsPerCall: values,
      min: sorted[0],
      median: sorted[Math.floor(sorted.length / 2)],
      max: sorted.at(-1),
    };
  }),
};
const json = JSON.stringify(result, null, 2) + '\n';
if (process.argv[2]) await writeFile(process.argv[2], json);
console.log(json);
