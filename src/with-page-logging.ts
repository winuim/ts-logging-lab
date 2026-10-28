import { Browser, BrowserContext, Keyboard, Locator, Page } from 'puppeteer';

import { createLoggingProxy } from './logging-proxy.js';
import type { LogOptions } from './log-event.js';

export function withBrowserLogging(
  browser: Browser,
  options: LogOptions = {},
): Browser {
  return createLoggingProxy(browser, {
    ...options,
    name: 'browser',
    resourceKind: 'browser',
    asyncMethods: ['newPage', 'createBrowserContext'],
    wrapResult: (value) => {
      if (value instanceof Page) return withPageLogging(value, options);
      if (value instanceof BrowserContext)
        return withBrowserContextLogging(value, options);
      return value;
    },
  });
}

export function withPageLogging<T extends Pick<Page, 'goto'>>(
  page: T,
  options: LogOptions = {},
): T {
  return createLoggingProxy(page, {
    ...options,
    name: 'page',
    resourceKind: 'page',
    asyncMethods: ['goto'],
    wrapResult: (value, property) => {
      if (property === 'browserContext' && value instanceof BrowserContext)
        return withBrowserContextLogging(value, options);
      if (property === 'browser' && value instanceof Browser)
        return withBrowserLogging(value, options);
      if (property === 'keyboard' && value instanceof Keyboard)
        return withKeyboardLogging(value, options);
      if (property === 'locator' && value instanceof Locator)
        return withLocatorLogging(value, options);
      return value;
    },
  });
}

export function withKeyboardLogging(
  keyboard: Keyboard,
  options: LogOptions = {},
): Keyboard {
  return createLoggingProxy(keyboard, {
    ...options,
    name: 'keyboard',
    resourceKind: 'keyboard',
    asyncMethods: ['type', 'press'],
  });
}

export function withLocatorLogging<T>(
  locator: Locator<T>,
  options: LogOptions = {},
): Locator<T> {
  return createLoggingProxy(locator, {
    ...options,
    name: 'locator',
    resourceKind: 'locator',
    asyncMethods: ['click', 'fill'],
    wrapResult: (value) =>
      value instanceof Locator ? withLocatorLogging(value, options) : value,
  });
}

export function withBrowserContextLogging(
  context: BrowserContext,
  options: LogOptions = {},
): BrowserContext {
  return createLoggingProxy(context, {
    ...options,
    name: 'context',
    resourceKind: 'context',
    asyncMethods: ['newPage'],
    wrapResult: (value) => {
      if (value instanceof Page) return withPageLogging(value, options);
      if (value instanceof Browser) return withBrowserLogging(value, options);
      return value;
    },
  });
}
