import puppeteer from 'puppeteer';
import { expect, test } from 'vitest';
import {
  ResourceContext,
  unwrap,
  withBrowserLogging,
} from '../../src/index.js';
import type { LogEvent } from '../../src/index.js';

test('実Browser/Context/複数PageをProxy・実体で安定して区別する', async () => {
  const raw = await puppeteer.launch({ headless: true });
  const resources = new ResourceContext();
  const events: LogEvent[] = [];
  try {
    const browser = withBrowserLogging(raw, {
      resources,
      adapter: {
        emit(event) {
          events.push(event);
        },
      },
    });
    const context = await browser.createBrowserContext();
    const a = await context.newPage();
    const b = await context.newPage();
    await Promise.all([a.goto('about:blank'), b.goto('about:blank')]);
    expect(resources.id(a, 'page')).toBe(resources.id(unwrap(a), 'page'));
    expect(resources.id(a, 'page')).not.toBe(resources.id(b, 'page'));
    expect(resources.id(context, 'context')).not.toBe(
      resources.id(browser, 'browser'),
    );
    const pageEvents = events.filter(
      (event) => event.operation === 'page.goto',
    );
    expect(
      new Set(pageEvents.map((event) => event.attributes['resourceId'])).size,
    ).toBe(2);
    expect(a.browserContext()).toBe(context);
    expect(context.browser()).toBe(browser);
    await context.close();
  } finally {
    await raw.close();
  }
}, 20_000);
