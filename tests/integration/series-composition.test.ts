import { execFile } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const example = fileURLToPath(
  new URL('../../examples/part-11.mjs', import.meta.url),
);

type CapturedRecord = Partial<
  Record<
    | 'kind'
    | 'operation'
    | 'phase'
    | 'runId'
    | 'category'
    | 'level'
    | 'event'
    | 'message'
    | 'msg'
    | 'operationId'
    | 'attributes'
    | 'durationMs',
    unknown
  >
>;

function isRecord(value: unknown): value is CapturedRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

test.each(['console', 'pino-debug', 'pino-info'] as const)(
  '第11回の統合例を別プロセスで検証する: %s',
  async (mode) => {
    // 別プロセスで新しいPageとレジストリを使い、初回設定を混ぜない。
    const { stdout, stderr } = await execute(
      process.execPath,
      [example, mode],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 45_000,
        maxBuffer: 1024 * 1024,
      },
    );
    const output = `${stdout}\n${stderr}`;
    const records = output
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => {
        const value: unknown = JSON.parse(line);
        if (!isRecord(value)) throw new Error('Expected a JSON log record');
        return value;
      });
    const filtered = mode === 'pino-info';
    const consoleOutput = mode === 'console';
    expect(records).toHaveLength(filtered ? 6 : 11);

    const operations = records.filter((record) => record.kind !== 'diagnostic');
    expect(operations).toHaveLength(filtered ? 1 : 6);
    for (const record of operations) {
      expect(record.operation).toBe('page.goto');
      expect(record).not.toHaveProperty('kind');
      expect(record.category).toBe('browser');
      expect(record.operationId).toEqual(expect.any(String));
      expect(['run-1', 'run-2']).toContain(record.runId);
      if (record.phase === 'start') {
        expect(record.attributes).toEqual({ argumentCount: 1 });
        expect(record).not.toHaveProperty('durationMs');
      } else {
        expect(record.durationMs).toEqual(expect.any(Number));
        expect(record.attributes).toEqual(
          record.phase === 'success'
            ? { isNull: true }
            : { errorType: 'navigation-failed' },
        );
      }
    }
    const failures = operations.filter((record) => record.phase === 'failure');
    expect(failures).toHaveLength(1);
    expect(failures[0]?.runId).toBe('run-1');
    if (!filtered) {
      const starts = operations.filter((record) => record.phase === 'start');
      expect(starts).toHaveLength(3);
      expect(new Set(starts.map((record) => record.operationId)).size).toBe(3);
      expect(
        operations.filter((record) => record.phase === 'success'),
      ).toHaveLength(2);
      for (const start of starts) {
        const pair = operations.filter(
          (record) => record.operationId === start.operationId,
        );
        expect(pair).toHaveLength(2);
        expect(pair.filter((record) => record.phase === 'start')).toHaveLength(
          1,
        );
        expect(pair.every((record) => record.runId === start.runId)).toBe(true);
      }
    }

    const diagnostics = records.filter(
      (record) => record.kind === 'diagnostic',
    );
    expect(diagnostics).toHaveLength(5);
    for (const record of diagnostics) {
      expect(record.category).toBe('browser');
      for (const key of ['operation', 'phase', 'operationId', 'durationMs']) {
        expect(record).not.toHaveProperty(key);
      }
      expect(record[consoleOutput ? 'message' : 'msg']).toBe(
        'Diagnostic event',
      );
    }
    const pageErrors = diagnostics.filter(
      (record) => record.event === 'puppeteer.pageerror',
    );
    const requestFailures = diagnostics.filter(
      (record) => record.event === 'puppeteer.requestfailed',
    );
    expect(pageErrors).toHaveLength(2);
    expect(requestFailures).toHaveLength(2);
    // Puppeteer由来のrunId伝播は保証せず、操作との自動相関も要求しない。
    for (const record of [...pageErrors, ...requestFailures]) {
      expect(record).not.toHaveProperty('attributes');
    }
    const probes = diagnostics.filter(
      (record) => record.event === 'example.redaction',
    );
    expect(probes).toHaveLength(1);
    expect(probes[0]?.runId).toBe('run-probe');
    expect(probes[0]?.attributes).toEqual({
      dummySecret: consoleOutput ? 'dummy-redaction-probe' : '[REDACTED]',
    });
    for (const record of records) {
      expect(typeof record.level).toBe(consoleOutput ? 'string' : 'number');
      expect(record).not.toHaveProperty(consoleOutput ? 'msg' : 'message');
    }
    for (const secret of [
      'dummy-private-error',
      'example.test',
      'dummy-token',
      'not-a-valid-url',
    ]) {
      expect(output).not.toContain(secret);
    }
    if (!consoleOutput) expect(output).not.toContain('dummy-redaction-probe');
  },
  60_000,
);
